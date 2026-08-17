import {
  Injectable,
  Optional,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@laoma/shared';
import { canTransition } from './order-status';
import { OrdersGateway } from '../gateway/orders.gateway';
import { SettlementsService } from '../settlements/settlements.service';
import { PaymentsService } from '../payments/payments.service';

function genOrderNo() {
  return (
    'LM' +
    Date.now().toString(36).toUpperCase() +
    Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')
  );
}

// 支付后（含平台托管）的状态：这些阶段取消都需走退款
const POST_PAY_STATES = [
  OrderStatus.PendingAccept,
  OrderStatus.Accepted,
  OrderStatus.Servicing,
  OrderStatus.PendingConfirm,
];

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private settlements: SettlementsService,
    private payments: PaymentsService,
    @Optional() private gateway?: OrdersGateway,
  ) {}

  private async masterIdOf(userId: string) {
    const m = await this.prisma.master.findUnique({ where: { userId } });
    if (!m) throw new BadRequestException('当前账号不是师傅');
    return m.id;
  }

  private async masterIdOfSafe(userId: string): Promise<string | null> {
    const m = await this.prisma.master.findUnique({ where: { userId } });
    return m?.id ?? null;
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

    // 下单即进入「待支付」态（支付前置模型）；支付成功后再入抢单池。
    const order = await this.prisma.order.create({
      data: {
        orderNo: genOrderNo(),
        customerId,
        addressId: dto.addressId,
        serviceItemId: dto.serviceItemId,
        serviceSnapshot: item as any,
        city: addr.city,
        amount: item.price,
        appointmentDate: dto.appointmentDate ? new Date(dto.appointmentDate) : null,
        appointmentSlot: dto.appointmentSlot,
        remark: dto.remark,
        customerPhotos: dto.photos ?? undefined,
        status: OrderStatus.PendingPayment,
      },
    });
    return order;
  }

  async listForCustomer(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        serviceItem: true,
        master: {
          include: {
            user: { select: { phone: true, profile: { select: { nickname: true } } } },
          },
        },
        address: true,
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
    // 乐观锁：仅当订单处于「待接单」且尚无师傅接走(masterId=null)时原子抢占，
    // 避免并发被多师傅同时抢走（第二个抢单者 count=0 即失败）。
    const locked = await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PendingAccept, masterId: null },
      data: { masterId: mid },
    });
    if (locked.count === 0)
      throw new BadRequestException('手慢了，该订单已被其他师傅接走');
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
    const mid = await this.masterIdOf(userId);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order?.masterId !== mid)
      throw new ForbiddenException('只能操作自己接的单');
    return this.transition(orderId, OrderStatus.Servicing, userId, '开始服务');
  }

  async complete(orderId: string, userId: string) {
    const mid = await this.masterIdOf(userId);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order?.masterId !== mid)
      throw new ForbiddenException('只能操作自己接的单');
    return this.transition(
      orderId,
      OrderStatus.PendingConfirm,
      userId,
      '完成服务',
    );
  }

  /** 客户验收：待验收 → 已评价，并释放平台托管金给师傅（结算台账） */
  async confirm(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.customerId !== userId)
      throw new ForbiddenException('无权操作该订单');
    const updated = await this.transition(
      orderId,
      OrderStatus.Reviewed,
      userId,
      '客户验收完成',
    );
    await this.settlements.releaseToMaster(orderId);
    return updated;
  }

  /** 取消：支付前取消无退款；支付后取消走退款（refunding → refunded） */
  async cancel(orderId: string, userId: string, isAdmin = false) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const isCustomer = order.customerId === userId;
    const mid = await this.masterIdOfSafe(userId);
    const isMaster = !!mid && order.masterId === mid;
    if (!isCustomer && !isMaster && !isAdmin)
      throw new ForbiddenException('无权取消该订单');

    if (POST_PAY_STATES.includes(order.status as OrderStatus)) {
      await this.transition(orderId, OrderStatus.Refunding, userId, '取消（发起退款）');
      await this.payments.refund(order.customerId, orderId);
      return this.prisma.order.findUnique({ where: { id: orderId } });
    }
    return this.transition(orderId, OrderStatus.Cancelled, userId, '取消');
  }
}
