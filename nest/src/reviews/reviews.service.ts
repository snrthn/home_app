import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@laoma/shared';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

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
    if (
      order.status !== OrderStatus.Paid &&
      order.status !== OrderStatus.Reviewed
    )
      throw new BadRequestException('订单未完成支付，不可评价');
    if (order.status === OrderStatus.Reviewed)
      throw new BadRequestException('订单已评价');

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
    await this.prisma.order.update({
      where: { id: dto.orderId },
      data: { status: OrderStatus.Reviewed },
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
      include: { master: { include: { user: { include: { profile: { select: { nickname: true } } } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
