import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { isBlacklisted } from '../auth/token-blacklist';
import { PrismaService } from '../prisma/prisma.service';
import type { Role } from '@laoma/shared';

interface WsServer {
  to(room: string): { emit(event: string, data: unknown): void };
  emit(event: string, data: unknown): void;
}

interface WsSocket {
  id: string;
  data: { user?: { sub: string; role: Role } };
  handshake: { auth?: { token?: string } };
  join(room: string): void;
  leave(room: string): void;
}

interface ServiceAreaEntry {
  provinceCode?: string | null;
  cityCode?: string | null;
  districtCode?: string | null;
}

interface OrderWithAddress {
  id: string;
  address?: {
    provinceCode?: string | null;
    cityCode?: string | null;
    districtCode?: string | null;
  } | null;
}

@WebSocketGateway({ cors: true, path: '/ws' })
export class OrdersGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer() server: WsServer;
  private logger = new Logger('OrdersGateway');

  constructor(private jwt: JwtService, private prisma: PrismaService) {}

  afterInit(server: WsServer & { use: (fn: (socket: WsSocket, next: (err?: Error) => void) => void) => void }) {
    server.use((socket: WsSocket, next: (err?: Error) => void) => {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      try {
        const payload = this.jwt.verify(token) as { sub: string; role: Role; jti: string };
        if (isBlacklisted(payload.jti)) return next(new Error('unauthorized'));
        socket.data.user = { sub: payload.sub, role: payload.role };
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  handleConnection(socket: WsSocket) {
    const role = socket.data?.user?.role;
    const sub = socket.data?.user?.sub;
    this.logger.log(`[WS connect] id=${socket.id} sub=${sub} role=${role}`);
    if (role === 'admin') {
      socket.join('admin-dashboard');
      socket.join('tickets-pool');
      this.logger.log(`[WS room] admin joined admin-dashboard + tickets-pool`);
    }
  }

  handleDisconnect(socket: WsSocket) {
    const role = socket.data?.user?.role;
    this.logger.log(`client disconnected: ${socket.data?.user?.sub} (${role})`);
  }

  notifyDashboardRefresh() {
    this.server?.to('admin-dashboard').emit('dashboard-refresh', null);
  }

  @SubscribeMessage('subscribe-order')
  handleSubscribe(@ConnectedSocket() socket: WsSocket, @MessageBody() orderId: string) {
    if (orderId) socket.join(`order:${orderId}`);
  }

  @SubscribeMessage('unsubscribe-order')
  handleUnsubscribe(@ConnectedSocket() socket: WsSocket, @MessageBody() orderId: string) {
    if (orderId) socket.leave(`order:${orderId}`);
  }

  @SubscribeMessage('join-pool')
  async handleJoinPool(@ConnectedSocket() socket: WsSocket) {
    const role = socket.data?.user?.role;
    const sub = socket.data?.user?.sub;
    this.logger.log(`[WS join-pool] id=${socket.id} sub=${sub} role=${role}`);
    if (role !== 'master') {
      this.logger.warn(`[WS join-pool] rejected: role=${role} is not master`);
      return;
    }
    let areas: ServiceAreaEntry[] = [];
    try {
      const master = await this.prisma.master.findUnique({
        where: { userId: sub },
        select: { serviceAreas: true },
      });
      areas = Array.isArray(master?.serviceAreas) ? (master!.serviceAreas as ServiceAreaEntry[]) : [];
      this.logger.log(`[WS join-pool] master serviceAreas count=${areas.length}`);
    } catch (e) {
      this.logger.error(`[WS join-pool] db query failed: ${e}`);
      areas = [];
    }
    if (areas.length === 0) {
      socket.join('pool');
      this.logger.log(`[WS join-pool] joined room=pool (no service areas)`);
      return;
    }
    let joinedAny = false;
    const joinedRooms: string[] = [];
    for (const a of areas) {
      const p = a?.provinceCode, c = a?.cityCode, d = a?.districtCode;
      if (!p) continue;
      const r1 = `zone:${p}::`;
      socket.join(r1);
      joinedRooms.push(r1);
      if (c) {
        const r2 = `zone:${p}:${c}:`;
        socket.join(r2);
        joinedRooms.push(r2);
      }
      if (d) {
        const r3 = `zone:${p}:${c}:${d}`;
        socket.join(r3);
        joinedRooms.push(r3);
      }
      joinedAny = true;
    }
    if (!joinedAny) {
      socket.join('pool');
      joinedRooms.push('pool');
    }
    this.logger.log(`[WS join-pool] joined rooms=[${joinedRooms.join(', ')}]`);
  }

  @SubscribeMessage('leave-pool')
  handleLeavePool(@ConnectedSocket() socket: WsSocket) {
    socket.leave('pool');
  }

  private dispatchZones(order: OrderWithAddress): string[] {
    const addr = order?.address;
    const p = addr?.provinceCode, c = addr?.cityCode, d = addr?.districtCode;
    const rooms = ['pool'];
    if (p) {
      rooms.push(`zone:${p}::`);
      if (c) rooms.push(`zone:${p}:${c}:`);
      if (d) rooms.push(`zone:${p}:${c}:${d}`);
    }
    return rooms;
  }

  broadcastNewOrder(order: OrderWithAddress) {
    const rooms = this.dispatchZones(order);
    this.logger.log(`[WS broadcast] new-order orderId=${order?.id} rooms=[${rooms.join(', ')}]`);
    for (const room of rooms) this.server?.to(room).emit('new-order', order);
    this.notifyDashboardRefresh();
  }

  broadcastOrderUpdate(order: { id: string }) {
    this.server?.to(`order:${order.id}`).emit('order-update', order);
    this.notifyDashboardRefresh();
  }

  broadcastPoolUpdate(order: OrderWithAddress) {
    const rooms = this.dispatchZones(order);
    this.logger.log(`[WS broadcast] pool-update orderId=${order?.id} rooms=[${rooms.join(', ')}]`);
    for (const room of rooms) this.server?.to(room).emit('order-update', order);
    this.notifyDashboardRefresh();
  }

  broadcastTicketUpdate(ticket: unknown) {
    this.server?.to('tickets-pool').emit('ticket-update', ticket);
  }

  /**
   * 广播 Sentry 配置变更：运营平台更新 sentryDsn 后通知所有在线客户端。
   * 客户端收到后 initSentry(dsn) 或 closeSentry()。
   */
  broadcastSentryConfig(dsn: string | null) {
    this.server?.emit('sentry:config', { dsn: dsn || '' });
  }
}
