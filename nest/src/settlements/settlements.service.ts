import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettlementsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.settlement.findMany({
      include: {
        master: { include: { user: { include: { profile: { select: { nickname: true } } } } } },
        order: { select: { orderNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 对 paid 订单且未生成台账的生成记录（幂等）。平台不参与分账，全额给师傅。
  async syncForPaidOrders() {
    const paidOrders = await this.prisma.order.findMany({
      where: { status: 'paid' },
    });
    const created = [];
    for (const o of paidOrders) {
      const exist = await this.prisma.settlement.findUnique({
        where: { orderId: o.id },
      });
      if (!exist) {
        const rec = await this.prisma.settlement.create({
          data: {
            orderId: o.id,
            masterId: o.masterId!,
            orderAmount: o.amount,
            platformFee: 0,
            masterAmount: o.amount,
            status: 'offline_pending',
          },
        });
        created.push(rec);
      }
    }
    return created;
  }

  async markOfflineDone(id: string, note?: string) {
    return this.prisma.settlement.update({
      where: { id },
      data: { status: 'offline_done', settledAt: new Date(), note },
    });
  }
}
