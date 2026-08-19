import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@laoma/shared';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
  ) {}

  async create(
    customerId: string,
    dto: {
      orderId: string;
      rating: number;
      comment?: string;
      anonymous?: boolean;
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.customerId !== customerId)
      throw new ForbiddenException('无权评价');
    // 支付前置模型：验收(confirm)是资金释放唯一终态入口（PendingConfirm→Reviewed + 释放托管金）。
    // 评价仅在 Reviewed 之上追加纯展示流转（Reviewed→Evaluated 已评价标记），不碰资金，
    // 不会形成双入口（托管金释放在 confirm 内完成，与本流转无关）。
    if (order.status !== OrderStatus.Reviewed)
      throw new BadRequestException('请先在订单中确认验收，再评价');
    const existed = await this.prisma.review.findUnique({
      where: { orderId: dto.orderId },
    });
    if (existed) throw new BadRequestException('订单已评价');

    const review = await this.prisma.review.create({
      data: {
        orderId: dto.orderId,
        customerId,
        masterId: order.masterId!,
        rating: dto.rating,
        comment: dto.comment,
        anonymous: dto.anonymous ?? false,
      },
    });

    // 评价完成 → 订单置「已评价」（evaluated）。统一走订单状态机：
    // canTransition 校验 + 统一日志(action='review') + 实时广播，师傅端详情页即时可见。
    await this.orders.transition(
      dto.orderId,
      OrderStatus.Evaluated,
      customerId,
      `客户评价 ${dto.rating} 星${dto.anonymous ? '（匿名）' : ''}`,
      undefined,
      'review',
    );

    // 更新师傅评分（均值）与订单量
    const stats = await this.prisma.review.aggregate({
      where: { masterId: order.masterId! },
      _avg: { rating: true },
      _count: { id: true },
    });
    await this.prisma.master.update({
      where: { id: order.masterId! },
      data: { rating: stats._avg.rating ?? 5, orderCount: stats._count.id },
    });
    return review;
  }

  async listByMaster(masterId: string) {
    return this.prisma.review.findMany({
      where: { masterId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll() {
    return this.prisma.review.findMany({
      include: {
        master: { include: { user: { include: { profile: { select: { nickname: true } } } } } },
        customer: { select: { profile: { select: { nickname: true } } } },
        order: { select: { orderNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
