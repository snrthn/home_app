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

@WebSocketGateway({ cors: true, path: '/ws' })
export class OrdersGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer() server: any;
  private logger = new Logger('OrdersGateway');

  constructor(private jwt: JwtService) {}

  // WS 握手鉴权：连接必须携带合法 JWT（与 HTTP 端同一套 Bearer token）。
  // 无 token / 过期 / 已拉黑 → 拒绝握手，前端收到 connect_error: 'unauthorized'。
  afterInit(server: any) {
    server.use((socket: any, next: (err?: Error) => void) => {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      try {
        const payload = this.jwt.verify(token) as any;
        if (isBlacklisted(payload.jti)) return next(new Error('unauthorized'));
        socket.data.user = { sub: payload.sub, role: payload.role };
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  handleConnection(socket: any) {
    const role = socket.data?.user?.role;
    this.logger.log(`client connected: ${socket.data?.user?.sub} (${role})`);
    // admin 自动加入工作台刷新房，收到 dashboard-refresh 信号。
    // 注：师傅在线不再按 WS 连接判定（师傅端只有接单页/订单页才建连接），
    // 改由 auth.lastActiveAt + 前端心跳判定，见 reports.service。
    if (role === 'admin') {
      socket.join('admin-dashboard');
      socket.join('tickets-pool'); // 工单池实时刷新房间
    }
  }

  handleDisconnect(socket: any) {
    const role = socket.data?.user?.role;
    this.logger.log(`client disconnected: ${socket.data?.user?.sub} (${role})`);
    // WS 断开 ≠ 离线：师傅可能只是切页面。在线状态由 lastActiveAt 窗口兜底。
  }

  // 通知工作台刷新（订单状态变化、新单入池时调用；师傅上线下线由 auth 心跳/登出触发）
  notifyDashboardRefresh() {
    this.server?.to('admin-dashboard').emit('dashboard-refresh');
  }

  // 订阅某订单详情：只有订阅者才会收到该订单的 order-update
  @SubscribeMessage('subscribe-order')
  handleSubscribe(@ConnectedSocket() socket: any, @MessageBody() orderId: string) {
    if (orderId) socket.join(`order:${orderId}`);
  }

  @SubscribeMessage('unsubscribe-order')
  handleUnsubscribe(@ConnectedSocket() socket: any, @MessageBody() orderId: string) {
    if (orderId) socket.leave(`order:${orderId}`);
  }

  // 进入接单池：仅师傅（role=master）可加入，避免客户/管理员混入接单池
  @SubscribeMessage('join-pool')
  handleJoinPool(@ConnectedSocket() socket: any) {
    if (socket.data?.user?.role === 'master') socket.join('pool');
  }

  @SubscribeMessage('leave-pool')
  handleLeavePool(@ConnectedSocket() socket: any) {
    socket.leave('pool');
  }

  // 新订单入池：仅推送给接单池内的师傅
  broadcastNewOrder(order: any) {
    this.server?.to('pool').emit('new-order', order);
    this.notifyDashboardRefresh();
  }

  // 订单状态变更：仅推送给订阅了该订单详情的客户端
  broadcastOrderUpdate(order: any) {
    this.server?.to(`order:${order.id}`).emit('order-update', order);
    this.notifyDashboardRefresh();
  }

  // 订单离开接单态（被接走/取消）：推给接单池，让其他师傅的池子刷新移除
  broadcastPoolUpdate(order: any) {
    this.server?.to('pool').emit('order-update', order);
    this.notifyDashboardRefresh();
  }

  // 工单池刷新：推送给管理端工单池房间（tickets-pool）
  broadcastTicketUpdate(ticket: any) {
    this.server?.to('tickets-pool').emit('ticket-update', ticket);
  }
}
