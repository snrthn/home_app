import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(
    customerId: string,
    dto: { orderId: string; qrType: string; proofUrl?: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.customerId !== customerId)
      throw new ForbiddenException('无权操作该订单');
    return this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        customerId,
        masterId: order.masterId,
        qrType: dto.qrType,
        proofUrl: dto.proofUrl,
        amount: order.amount,
        status: 'paid', // 客户已付，待后台确认
      },
    });
  }

  async confirm(id: string, adminId: string) {
    return this.prisma.payment.update({
      where: { id },
      data: { status: 'confirmed', confirmedBy: adminId, paidAt: new Date() },
    });
  }

  async list() {
    return this.prisma.payment.findMany({
      include: {
        order: { select: { orderNo: true, amount: true } },
        customer: { select: { profile: { select: { nickname: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
