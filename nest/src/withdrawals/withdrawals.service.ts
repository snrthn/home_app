import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WithdrawalsService {
  constructor(private prisma: PrismaService) {}

  /** 师傅发起提现申请：事务内实时聚合余额校验（防并发超提），申请即冻结（pending 计入占用）。 */
  async create(userId: string, dto: { amount: number; channel: string; account: string }) {
    const amount = Math.round(dto.amount * 100) / 100;
    if (amount <= 0) throw new BadRequestException('提现金额必须大于 0');

    const master = await this.prisma.master.findUnique({
      where: { userId },
    });
    if (!master) throw new NotFoundException('师傅账号不存在');

    return this.prisma.$transaction(async (tx) => {
      const [creditedAgg, paidAgg, pendingAgg] = await Promise.all([
        tx.settlement.aggregate({
          where: { masterId: master.id, status: 'credited', deletedAt: null },
          _sum: { masterAmount: true },
        }),
        tx.withdrawal.aggregate({
          where: { masterId: master.id, status: 'paid', deletedAt: null },
          _sum: { amount: true },
        }),
        tx.withdrawal.aggregate({
          where: { masterId: master.id, status: 'pending', deletedAt: null },
          _sum: { amount: true },
        }),
      ]);
      const available =
        Math.round(
          (Number(creditedAgg._sum.masterAmount ?? 0) -
            Number(paidAgg._sum.amount ?? 0) -
            Number(pendingAgg._sum.amount ?? 0)) *
            100,
        ) / 100;
      if (amount > available)
        throw new BadRequestException(
          `可提现余额不足（当前可提现 ¥${available.toFixed(2)}）`,
        );
      return tx.withdrawal.create({
        data: {
          masterId: master.id,
          amount,
          channel: dto.channel as any,
          account: dto.account,
          status: 'pending',
        },
      });
    });
  }

  /** 师傅提现记录 */
  async mine(userId: string) {
    const master = await this.prisma.master.findUnique({
      where: { userId },
    });
    if (!master) return [];
    return this.prisma.withdrawal.findMany({
      where: { masterId: master.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 管理端提现列表（可按状态筛） */
  list(status?: string) {
    return this.prisma.withdrawal.findMany({
      where: {
        deletedAt: null,
        ...(status && ['pending', 'paid', 'rejected'].includes(status)
          ? { status: status as any }
          : {}),
      },
      include: {
        master: {
          include: {
            user: { include: { profile: { select: { nickname: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 管理端标记已打款：pending → paid（乐观锁，只更新仍是 pending 的行） */
  async markPaid(id: string, adminId: string) {
    const res = await this.prisma.withdrawal.updateMany({
      where: { id, status: 'pending', deletedAt: null },
      data: { status: 'paid', paidAt: new Date(), reviewedBy: adminId },
    });
    if (res.count === 0) {
      const w = await this.prisma.withdrawal.findUnique({ where: { id } });
      if (!w) throw new NotFoundException('提现单不存在');
      throw new BadRequestException('仅待审核的提现单可标记打款');
    }
    return this.prisma.withdrawal.findUnique({ where: { id } });
  }

  /** 管理端驳回：pending → rejected（解冻退回余额），必填原因 */
  async reject(id: string, adminId: string, reason: string) {
    const res = await this.prisma.withdrawal.updateMany({
      where: { id, status: 'pending', deletedAt: null },
      data: { status: 'rejected', reviewNote: reason, reviewedBy: adminId },
    });
    if (res.count === 0) {
      const w = await this.prisma.withdrawal.findUnique({ where: { id } });
      if (!w) throw new NotFoundException('提现单不存在');
      throw new BadRequestException('仅待审核的提现单可驳回');
    }
    return this.prisma.withdrawal.findUnique({ where: { id } });
  }
}
