import {
  Injectable,
  Optional,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@laoma/shared';
import { canTransition } from './order-status';
import { OrdersGateway } from '../gateway/orders.gateway';

function genOrderNo() {
  return (
    'LM' +
    Date.now().toString(36).toUpperCase() +
    Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')
  );
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    @Optional() private gateway?: OrdersGateway,
  ) {}

  private async masterIdOf(userId: string) {
    const m = await this.prisma.master.findUnique({ where: { userId } });
    if (!m) throw new BadRequestException('当前账号不是师傅');
    return m.id;
  }

  async create(customerId: string, dto: any) {
    const item = await this.prisma.serviceItem.findUnique({
      where: { id: dto.serviceItemId },
    });
    if (!item || !item.isActive) throw new NotFoundException('服务项不存在');
    const addr = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId: customerId },
    });
    if (!addr) throw new NotFoundException('地址不存在');

    const order = await this.prisma.order.create({
      data: {
        orderNo: genOrderNo(),
        customerId,
        addressId: dto.addressId,
        serviceItemId: dto.serviceItemId,
        serviceSnapshot: item as any,
        // 订单区域跟随用户下单地址（服务本身不再绑定区域），取收货地址城市
        city: addr.city,
        amount: item.price,
        appointmentDate: dto.appointmentDate ? new Date(dto.appointmentDate) : null,
        appointmentSlot: dto.appointmentSlot,
        remark: dto.remark,
        customerPhotos: dto.photos ?? undefined,
        status: OrderStatus.PendingAccept,
      },
    });
    // 新订单入抢单池，实时推送给在线师傅端（网关未激活时跳过）
    this.gateway?.broadcastNewOrder(order);
    return order;
  }

  async listForCustomer(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        serviceItem: true,
        master: { include: { user: { include: { profile: { select: { nickname: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pool(city?: string) {
    return this.prisma.order.findMany({
      where: { status: OrderStatus.PendingAccept, ...(city ? { city } : {}) },
      include: { serviceItem: true, address: true },
    });
  }

  async listForMaster(userId: string, city?: string) {
    const mid = await this.masterIdOf(userId);
    return this.prisma.order.findMany({
      where: { masterId: mid, ...(city ? { city } : {}) },
      include: {
        serviceItem: true,
        address: true,
        customer: { select: { phone: true, profile: { select: { nickname: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll() {
    return this.prisma.order.findMany({
      include: {
        serviceItem: true,
        customer: { select: { phone: true, profile: { select: { nickname: true } } } },
        master: { include: { user: { include: { profile: { select: { nickname: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async transition(
    orderId: string,
    to: OrderStatus,
    actorId?: string,
    note?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (!canTransition(order.status, to))
      throw new BadRequestException(
        `状态不可从 ${order.status} 流转到 ${to}`,
      );
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: to },
    });
    await this.prisma.orderLog.create({
      data: {
        orderId,
        action: 'transition',
        fromStatus: order.status,
        toStatus: to,
        operatorId: actorId,
        note,
      },
    });
    this.gateway?.broadcastOrderUpdate(updated);
    return updated;
  }

  async grab(orderId: string, userId: string) {
    const mid = await this.masterIdOf(userId);
    await this.prisma.order.update({
      where: { id: orderId },
      data: { masterId: mid },
    });
    return this.transition(orderId, OrderStatus.Accepted, userId, '师傅抢单');
  }

  async assign(orderId: string, masterId: string, adminUserId: string) {
    await this.prisma.order.update({
      where: { id: orderId },
      data: { masterId },
    });
    return this.transition(
      orderId,
      OrderStatus.Accepted,
      adminUserId,
      '管理员指派',
    );
  }

  async startService(orderId: string, userId: string) {
    return this.transition(orderId, OrderStatus.Servicing, userId, '开始服务');
  }

  async complete(orderId: string, userId: string) {
    return this.transition(
      orderId,
      OrderStatus.PendingPayment,
      userId,
      '完成服务',
    );
  }

  async pay(orderId: string, userId: string) {
    return this.transition(orderId, OrderStatus.Paid, userId, '客户已支付');
  }

  async cancel(orderId: string, userId: string) {
    return this.transition(orderId, OrderStatus.Cancelled, userId, '取消');
  }
}
