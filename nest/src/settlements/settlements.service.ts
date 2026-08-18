import { Injectable, NotFoundException } from '@nestjs/common';
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

  // 对已验收（托管金释放）且未生成台账的生成记录（幂等）。平台不参与分账，全额给师傅。
  async syncForPaidOrders() {
    const paidOrders = await this.prisma.order.findMany({
      where: { status: { in: ['reviewed', 'evaluated'] } },
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

  // 释放平台托管金给师傅：订单验收(reviewed)后生成结算台账（幂等）。
  async releaseToMaster(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const exist = await this.prisma.settlement.findUnique({
      where: { orderId },
    });
    if (exist) return exist;
    return this.prisma.settlement.create({
      data: {
        orderId,
        masterId: order.masterId!,
        orderAmount: order.amount,
        platformFee: 0,
        masterAmount: order.amount,
        status: 'offline_pending',
      },
    });
  }
}
