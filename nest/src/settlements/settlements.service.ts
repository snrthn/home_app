import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettlementsService {
  constructor(private prisma: PrismaService) {}

  // ===== 管理端 =====

  list() {
    return this.prisma.settlement.findMany({
      include: {
        master: { include: { user: { include: { profile: { select: { nickname: true } } } } } },
        order: { select: { orderNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 对已验收（托管金释放）且未生成台账的补生成记录（幂等）。常规单即时入账。
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
            type: 'normal',
            status: 'credited',
            settledAt: new Date(),
          },
        });
        created.push(rec);
      }
    }
    return created;
  }

  /** 补偿单确认入账：pending → credited（管理端审核通过，金额进入师傅余额） */
  async credit(id: string, note?: string) {
    const s = await this.prisma.settlement.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('结算单不存在');
    if (s.status !== 'pending')
      throw new BadRequestException('仅待审核的补偿单可确认入账');
    return this.prisma.settlement.update({
      where: { id },
      data: { status: 'credited', settledAt: new Date(), note: note ?? s.note },
    });
  }

  /** 补偿单驳回：pending → rejected（不入账，需填原因） */
  async reject(id: string, reason: string) {
    const s = await this.prisma.settlement.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('结算单不存在');
    if (s.status !== 'pending')
      throw new BadRequestException('仅待审核的补偿单可驳回');
    return this.prisma.settlement.update({
      where: { id },
      data: { status: 'rejected', note: reason },
    });
  }

  /** 释放平台托管金给师傅：订单验收(reviewed)后生成结算台账（幂等）。
   *  常规单验收即时自动入账（status=credited）。 */
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
        type: 'normal',
        status: 'credited',
        settledAt: new Date(),
      },
    });
  }

  /** 阶梯退款时为师傅生成补偿单（departing 取消师傅得 20%、arrived 得 50%）。
   *  compensation = 订单金额 − 实退金额（由调用方 payments.refund 按比例算出传入）。
   *  补偿单不即时入账，需管理端审核确认。幂等：该订单已有结算单则跳过。 */
  async createCompensation(orderId: string, compensation: number) {
    const comp = Math.round(compensation * 100) / 100;
    if (comp <= 0) return null;
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !order.masterId) return null;
    const exist = await this.prisma.settlement.findUnique({ where: { orderId } });
    if (exist) return exist;
    return this.prisma.settlement.create({
      data: {
        orderId,
        masterId: order.masterId,
        orderAmount: order.amount,
        platformFee: 0,
        masterAmount: comp,
        type: 'compensation',
        status: 'pending',
        note: '阶梯退款补偿（待管理端审核入账）',
      },
    });
  }

  // ===== 师傅端：收入汇总与明细 =====

  /** 师傅收入汇总（实时聚合，无冗余余额字段）：
   *  累计入账 = Σ credited；本月入账 = 本月 Σ credited；待审核补偿 = Σ pending；
   *  可提现 = Σ credited − Σ 提现已打款 − Σ 提现待审核（申请即冻结）。 */
  async masterSummary(masterId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [creditedAgg, monthAgg, pendingAgg, paidWd, pendingWd] =
      await Promise.all([
        this.prisma.settlement.aggregate({
          where: { masterId, status: 'credited', deletedAt: null },
          _sum: { masterAmount: true },
        }),
        this.prisma.settlement.aggregate({
          where: {
            masterId,
            status: 'credited',
            deletedAt: null,
            settledAt: { gte: monthStart },
          },
          _sum: { masterAmount: true },
        }),
        this.prisma.settlement.aggregate({
          where: { masterId, status: 'pending', deletedAt: null },
          _sum: { masterAmount: true },
        }),
        this.prisma.withdrawal.aggregate({
          where: { masterId, status: 'paid', deletedAt: null },
          _sum: { amount: true },
        }),
        this.prisma.withdrawal.aggregate({
          where: { masterId, status: 'pending', deletedAt: null },
          _sum: { amount: true },
        }),
      ]);

    const totalCredited = Number(creditedAgg._sum.masterAmount ?? 0);
    const totalPaid = Number(paidWd._sum.amount ?? 0);
    const withdrawing = Number(pendingWd._sum.amount ?? 0);

    return {
      totalCredited: Math.round(totalCredited * 100) / 100, // 累计入账
      monthCredited: Math.round(Number(monthAgg._sum.masterAmount ?? 0) * 100) / 100, // 本月入账
      pendingCompensation:
        Math.round(Number(pendingAgg._sum.masterAmount ?? 0) * 100) / 100, // 待审核补偿（不计入余额）
      withdrawing, // 提现中（已冻结）
      totalWithdrawn: totalPaid, // 累计已提现
      available: Math.round((totalCredited - totalPaid - withdrawing) * 100) / 100, // 可提现余额
    };
  }

  /** 师傅收入明细：全部结算单（含待审核补偿/驳回），按时间倒序 */
  masterList(masterId: string) {
    return this.prisma.settlement.findMany({
      where: { masterId, deletedAt: null },
      include: {
        order: { select: { orderNo: true, serviceSnapshot: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
