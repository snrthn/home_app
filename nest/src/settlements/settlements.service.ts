import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommissionService } from '../commission/commission.service';
import { round2, sub2, lt } from '../common/money';

@Injectable()
export class SettlementsService implements OnModuleInit {
  private readonly logger = new Logger(SettlementsService.name);
  private readonly RECONCILE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 小时

  constructor(
    private prisma: PrismaService,
    private commission: CommissionService,
  ) {}

  onModuleInit() {
    setInterval(() => {
      this.reconcile().then((r) => {
        if (r.issues.length > 0) {
          this.logger.warn(`[对账巡检] 发现 ${r.issues.length} 项异常`);
        }
      }).catch((err) => {
        this.logger.error('[对账巡检] 执行失败:', err);
      });
    }, this.RECONCILE_INTERVAL_MS);
  }

  // ===== 管理端 =====

  list() {
    return this.prisma.settlement
      .findMany({
        include: {
          master: {
            include: { user: { include: { profile: { select: { nickname: true } } } } },
          },
          order: { select: { orderNo: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => this.attachReviewers(rows))
      .then((rows) => this.withRefundAmount(rows));
  }

  /** 按订单查结算单（含常规单/退款补偿单），供三端订单详情展示补偿说明 */
  async byOrder(orderId: string) {
    const rows = await this.prisma.settlement.findMany({
      where: { orderId, deletedAt: null },
      include: { order: { select: { orderNo: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return this.attachReviewers(rows).then((rows) => this.withRefundAmount(rows));
  }

  /** 给用户看到「自己退回多少」一个明确、可核查的字段：用户退款 = 订单额 − 平台留成 − 师傅所得。
   *  对补偿单：平台留成=platformFee、师傅所得=masterAmount，二者之和为未退部分，故该差值即退用户金额（与 payments.refund 的 splitRefund 精确一致）。
   *  对常规单：无退款，结果为 0。 */
  private withRefundAmount<T extends { orderAmount: any; platformFee: any; masterAmount: any }>(
    rows: T[],
  ): (T & { refundAmount: number })[] {
    return rows.map((r) => ({
      ...r,
      refundAmount: sub2(Number(r.orderAmount), Number(r.platformFee) + Number(r.masterAmount)),
    }));
  }

  /** 附加审核人信息（reviewedBy 仅存 userId，需单独查 user 表） */
  private async attachReviewers<T extends { reviewedBy?: string | null }>(rows: T[]): Promise<any[]> {
    const ids = [...new Set(rows.map((r) => r.reviewedBy).filter(Boolean))] as string[];
    if (ids.length === 0) return rows.map((r) => ({ ...r, reviewedByUser: null }));
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, phone: true },
    });
    const map = new Map(users.map((u) => [u.id, u.phone]));
    return rows.map((r) => ({
      ...r,
      reviewedByUser: (r as any).reviewedBy
        ? { id: (r as any).reviewedBy, phone: map.get((r as any).reviewedBy) ?? null }
        : null,
    }));
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
        // 分账走订单快照（历史单无快照则实时解析兜底），未配规则时 platformRate=0 等价旧行为
        const snap = await this.commission.snapshotFromOrder(o);
        const { platformFee, masterAmount } = this.commission.splitNormal(
          Number(o.amount),
          snap,
        );
        const rec = await this.prisma.settlement.create({
          data: {
            orderId: o.id,
            masterId: o.masterId!,
            orderAmount: o.amount,
            platformFee,
            masterAmount,
            type: 'normal',
            status: 'credited',
            settledAt: new Date(),
            note: `常规结算｜平台佣金率 ${(snap.platformRate * 100).toFixed(2)}%（规则：${snap.source}）`,
          },
        });
        created.push(rec);
      }
    }
    return created;
  }

  /** 补偿单确认入账：pending → credited（管理端审核通过，金额进入师傅余额） */
  async credit(id: string, note?: string, reviewerId?: string) {
    const s = await this.prisma.settlement.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('结算单不存在');
    if (s.status !== 'pending')
      throw new BadRequestException('仅待审核的补偿单可确认入账');
    // 乐观锁：仅当仍为 pending 时才原子置为 credited，防止并发审批
    const locked = await this.prisma.settlement.updateMany({
      where: { id, status: 'pending' },
      data: {
        status: 'credited',
        settledAt: new Date(),
        note: note ?? s.note,
        reviewedBy: reviewerId ?? s.reviewedBy,
        reviewedAt: new Date(),
      },
    });
    if (locked.count === 0)
      throw new BadRequestException('该结算单已被并发审批，请刷新后重试');
    return this.prisma.settlement.findUnique({ where: { id } });
  }

  /** 补偿单驳回：pending → rejected（不入账，需填原因） */
  async reject(id: string, reason: string, reviewerId?: string) {
    const s = await this.prisma.settlement.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('结算单不存在');
    if (s.status !== 'pending')
      throw new BadRequestException('仅待审核的补偿单可驳回');
    // 乐观锁：仅当仍为 pending 时才原子置为 rejected，防止并发审批
    const locked = await this.prisma.settlement.updateMany({
      where: { id, status: 'pending' },
      data: {
        status: 'rejected',
        note: reason,
        reviewedBy: reviewerId ?? s.reviewedBy,
        reviewedAt: new Date(),
      },
    });
    if (locked.count === 0)
      throw new BadRequestException('该结算单已被并发审批，请刷新后重试');
    return this.prisma.settlement.findUnique({ where: { id } });
  }

  /** 释放平台托管金给师傅：订单验收(reviewed)后生成结算台账（幂等）。
   *  常规单验收即时自动入账（status=credited）。
   *  @param tx 可选事务客户端，传入时与 transition() 在同一事务内原子执行。 */
  async releaseToMaster(orderId: string, tx?: any) {
    const db = tx ?? this.prisma;
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (!order.masterId)
      throw new BadRequestException('该订单无师傅接单，无法生成结算');
    const exist = await db.settlement.findUnique({
      where: { orderId },
    });
    if (exist) return exist;
    // 平台佣金按订单快照解析（下单时固化），改类目佣金不影响历史单
    const snap = await this.commission.snapshotFromOrder(order);
    const { platformFee, masterAmount } = this.commission.splitNormal(
      Number(order.amount),
      snap,
    );
    try {
      return await db.settlement.create({
        data: {
          orderId,
          masterId: order.masterId,
          orderAmount: order.amount,
          platformFee,
          masterAmount,
          type: 'normal',
          status: 'credited',
          settledAt: new Date(),
          note: `常规结算｜平台佣金率 ${(snap.platformRate * 100).toFixed(2)}%（规则：${snap.source}）`,
        },
      });
    } catch (e: any) {
      // 并发场景：另一个事务已创建结算单，唯一约束拦截 → 返回已有记录
      if (e?.code === 'P2002') {
        return db.settlement.findUnique({ where: { orderId } });
      }
      throw e;
    }
  }

  /** 阶梯退款时为师傅生成补偿单。三方金额由调用方 payments.refund 依订单快照算出：
   *  未退给用户的留成 = platformKeep（平台佣金留成）+ compensation（师傅补偿）。
   *  补偿单不即时入账，需管理端审核确认。幂等：该订单已有结算单则跳过。
   *  @param tx 可选事务客户端，传入时与退款状态流转在同一事务内执行。 */
  async createCompensation(
    orderId: string,
    compensation: number,
    platformKeep = 0,
    ruleSource?: string,
    tx?: any,
  ) {
    const db = tx ?? this.prisma;
    const comp = round2(compensation);
    if (lt(comp, 0) || comp === 0) return null;
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order || !order.masterId) return null;
    const exist = await db.settlement.findUnique({ where: { orderId } });
    if (exist) return exist;
    const keep = round2(platformKeep);
    try {
      return await db.settlement.create({
        data: {
          orderId,
          masterId: order.masterId,
          orderAmount: order.amount,
          platformFee: keep,
          masterAmount: comp,
          type: 'compensation',
          status: 'pending',
          note:
            `阶梯退款补偿（待管理端审核入账）｜平台留成 ¥${keep.toFixed(2)}` +
            (ruleSource ? `｜规则：${ruleSource}` : ''),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return db.settlement.findUnique({ where: { orderId } });
      }
      throw e;
    }
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

    const totalCredited = round2(creditedAgg._sum.masterAmount ?? 0);
    const totalPaid = round2(paidWd._sum.amount ?? 0);
    const withdrawing = round2(pendingWd._sum.amount ?? 0);

    return {
      totalCredited, // 累计入账
      monthCredited: round2(monthAgg._sum.masterAmount ?? 0), // 本月入账
      pendingCompensation: round2(pendingAgg._sum.masterAmount ?? 0), // 待审核补偿（不计入余额）
      withdrawing, // 提现中（已冻结）
      totalWithdrawn: totalPaid, // 累计已提现
      available: sub2(totalCredited, totalPaid + withdrawing), // 可提现余额
    };
  }

  /** 师傅收入明细：全部结算单（含待审核补偿/驳回），按时间倒序 */
  masterList(masterId: string) {
    return this.prisma.settlement
      .findMany({
        where: { masterId, deletedAt: null },
        include: {
          order: { select: { orderNo: true, serviceSnapshot: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => this.withRefundAmount(rows));
  }

  // ===== 余额一致性对账巡检 =====

  /** 定时 + 手动触发：检测结算/提现/订单三类数据的一致性。
   *  不自动修复，仅产出异常报告供运营介入。 */
  async reconcile() {
    const issues: any[] = [];

    // 1. 孤儿订单：已验收(reviewed/evaluated)但无结算单
    const orphanOrders = await this.prisma.order.findMany({
      where: {
        status: { in: ['reviewed', 'evaluated'] },
        deletedAt: null,
      },
      select: {
        id: true,
        orderNo: true,
        masterId: true,
        amount: true,
        status: true,
      },
    });
    for (const o of orphanOrders) {
      const s = await this.prisma.settlement.findUnique({
        where: { orderId: o.id },
        select: { id: true },
      });
      if (!s) {
        issues.push({
          type: 'orphan_order',
          orderId: o.id,
          orderNo: o.orderNo,
          masterId: o.masterId,
          amount: Number(o.amount),
          detail: '已验收订单无结算单，需调用 syncForPaidOrders 补偿',
        });
      }
    }

    // 2. 不一致结算单：结算单存在但订单不在已验收/已退款状态
    const settlements = await this.prisma.settlement.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        orderId: true,
        masterId: true,
        type: true,
        status: true,
        masterAmount: true,
      },
    });
    for (const s of settlements) {
      const o = await this.prisma.order.findUnique({
        where: { id: s.orderId },
        select: { status: true, orderNo: true },
      });
      if (o && !['reviewed', 'evaluated', 'refunded', 'refunding'].includes(o.status)) {
        issues.push({
          type: 'inconsistent_settlement',
          settlementId: s.id,
          orderId: s.orderId,
          orderNo: o.orderNo,
          orderStatus: o.status,
          settlementType: s.type,
          detail: `订单状态为 ${o.status} 但存在结算单`,
        });
      }
    }

    // 3. 负余额师傅：可提现 < 0（提现超出入账）
    const creditedByMaster = await this.prisma.settlement.groupBy({
      by: ['masterId'],
      where: { status: 'credited', deletedAt: null },
      _sum: { masterAmount: true },
    });
    const paidByMaster = await this.prisma.withdrawal.groupBy({
      by: ['masterId'],
      where: { status: 'paid', deletedAt: null },
      _sum: { amount: true },
    });
    const pendingByMaster = await this.prisma.withdrawal.groupBy({
      by: ['masterId'],
      where: { status: 'pending', deletedAt: null },
      _sum: { amount: true },
    });
    const masterIds = new Set([
      ...creditedByMaster.map((r) => r.masterId),
      ...paidByMaster.map((r) => r.masterId),
      ...pendingByMaster.map((r) => r.masterId),
    ]);
    for (const masterId of masterIds) {
      if (!masterId) continue;
      const credited = round2(
        creditedByMaster.find((r) => r.masterId === masterId)?._sum.masterAmount ?? 0,
      );
      const paid = round2(
        paidByMaster.find((r) => r.masterId === masterId)?._sum.amount ?? 0,
      );
      const pending = round2(
        pendingByMaster.find((r) => r.masterId === masterId)?._sum.amount ?? 0,
      );
      const available = sub2(credited, paid + pending);
      if (available < 0) {
        issues.push({
          type: 'negative_balance',
          masterId,
          credited,
          totalWithdrawn: paid,
          withdrawing: pending,
          available,
          detail: `师傅可提现余额为负 ¥${available.toFixed(2)}，提现超出入账`,
        });
      }
    }

    return {
      checkedAt: new Date().toISOString(),
      totalMasters: masterIds.size,
      totalSettlements: settlements.length,
      totalOrders: orphanOrders.length,
      issues,
    };
  }
}
