import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { round2, add2 } from '../common/money';
import {
  Role,
  OrderStatus,
  PaymentStatus,
  SettlementType,
  SettlementStatus,
} from '@laoma/shared';

// 在线判定窗口：lastActiveAt 落在 5 分钟内视为「在线」。
// 前端 master 端每 2 分钟心跳保活；登录即在线；登出清空；关浏览器由窗口兜底掉线。
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

// 已支付状态：排除 PendingPayment（未付）、Cancelled（未付取消）、Refunded（已退款）
const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.PendingAccept,
  OrderStatus.Accepted,
  OrderStatus.Departing,
  OrderStatus.Arrived,
  OrderStatus.Servicing,
  OrderStatus.PendingConfirm,
  OrderStatus.Reviewed,
  OrderStatus.Evaluated,
  OrderStatus.Refunding,
];

// 完成状态：验收通过（已释放托管金）+ 已评价（闭环终态）
const DONE_STATUSES: OrderStatus[] = [OrderStatus.Reviewed, OrderStatus.Evaluated];

type BucketDim = 'day' | 'week' | 'month';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ================ 工作台聚合统计 ================
  // 今日订单/待接订单/在线师傅/本月GMV/本月平台净收入
  async dashboard() {
    // 北京时间今日 0 点（依赖服务器时区为 Asia/Shanghai）
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [todayOrders, pendingOrders, onlineMasters, gmvResult, revenueResult, pendingTickets] =
      await Promise.all([
        // 1. 今日订单（已支付）
        this.prisma.order.count({
          where: {
            createdAt: { gte: startOfToday },
            status: { in: PAID_STATUSES },
            deletedAt: null,
          },
        }),
        // 2. 待接订单
        this.prisma.order.count({
          where: {
            status: OrderStatus.PendingAccept,
            masterId: null,
            deletedAt: null,
          },
        }),
        // 3. 在线师傅（登录在线：lastActiveAt 落在 5 分钟窗口内）
        this.prisma.user.count({
          where: {
            role: Role.Master,
            status: 'active',
            deletedAt: null,
            lastActiveAt: { gte: new Date(now.getTime() - ONLINE_WINDOW_MS) },
          },
        }),
        // 4. 本月 GMV（已支付订单的 amount sum）
        this.prisma.order.aggregate({
          where: {
            createdAt: { gte: startOfMonth },
            status: { in: PAID_STATUSES },
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
        // 5. 本月平台净收入（已入账结算单的 platformFee sum：常规单抽佣 + 补偿单退款留成）
        this.prisma.settlement.aggregate({
          where: {
            status: SettlementStatus.Credited,
            settledAt: { gte: startOfMonth },
            deletedAt: null,
          },
          _sum: { platformFee: true },
        }),
        // 6. 待处理工单（待受理 open）
        this.prisma.ticket.count({
          where: { status: 'open', deletedAt: null },
        }),
      ]);

    return {
      todayOrders,
      pendingOrders,
      onlineMasters,
      monthlyGMV: round2(gmvResult._sum.amount ?? 0),
      monthlyPlatformRevenue: round2(revenueResult._sum.platformFee ?? 0),
      pendingTickets,
    };
  }

  // ================ 经营报表 ================
  // 订单量/营收(GMV)/退款/完成率，按日/周/月分桶。
  // 口径：营收按支付时间（Payment.paidAt）；退款金额由补偿单反推
  // （orderAmount - platformFee - masterAmount，settledAt 近似退款时间）；
  // 完成率 = (reviewed+evaluated) / 范围内创建的订单。
  async business(params: { dimension?: string; start?: string; end?: string } = {}) {
    const dim = this.normalizeDim(params.dimension);
    const { start, end } = this.range(params, 30);
    const seriesMap = this.initSeries(dim, start, end);

    const [payments, refunds, orders] = await Promise.all([
      // 已支付流水：营收 + 去重订单量
      this.prisma.payment.findMany({
        where: {
          paidAt: { gte: start, lte: end },
          status: { in: [PaymentStatus.Paid, PaymentStatus.Confirmed] },
          deletedAt: null,
        },
        select: { orderId: true, amount: true, paidAt: true },
      }),
      // 退款：直读 Refund 表（status=approved，refundedAmount 近似实退；reviewedAt 近似退款时间）
      this.prisma.refund.findMany({
        where: {
          status: 'approved',
          deletedAt: null,
          reviewedAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          orderId: true,
          amount: true,
          refundedAmount: true,
          reviewedAt: true,
        },
      }),
      // 范围内创建的订单：完成率分母/分子
      this.prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end }, deletedAt: null },
        select: { status: true, createdAt: true },
      }),
    ]);

    const paidOrderIds = new Set<string>();
    for (const p of payments) {
      if (!p.paidAt) continue;
      const s = seriesMap.get(this.bucketOf(dim, p.paidAt).getTime());
      if (!s) continue;
      s.gmv = add2(s.gmv, p.amount);
      if (!paidOrderIds.has(p.orderId)) {
        paidOrderIds.add(p.orderId);
        s.orders += 1;
      }
    }
    for (const r of refunds) {
      if (!r.reviewedAt) continue;
      const s = seriesMap.get(this.bucketOf(dim, r.reviewedAt).getTime());
      if (!s) continue;
      s.refundOrders += 1;
      s.refundAmount = add2(s.refundAmount, r.refundedAmount ?? r.amount);
    }
    for (const o of orders) {
      const s = seriesMap.get(this.bucketOf(dim, o.createdAt).getTime());
      if (!s) continue;
      s.createdOrders += 1;
      if (o.status === 'reviewed' || o.status === 'evaluated') s.doneOrders += 1;
    }

    const series = [...seriesMap.values()].map((s) => ({
      date: this.formatBucket(dim, s.date),
      orders: s.orders,
      gmv: round2(s.gmv),
      refundOrders: s.refundOrders,
      refundAmount: round2(s.refundAmount),
      createdOrders: s.createdOrders,
      doneOrders: s.doneOrders,
      completionRate: s.createdOrders
        ? round2((s.doneOrders / s.createdOrders) * 100)
        : 0,
    }));

    const summary = {
      totalOrders: series.reduce((a, s) => a + s.orders, 0),
      totalGMV: round2(series.reduce((a, s) => a + s.gmv, 0)),
      totalRefundOrders: series.reduce((a, s) => a + s.refundOrders, 0),
      totalRefundAmount: round2(series.reduce((a, s) => a + s.refundAmount, 0)),
      totalCreatedOrders: series.reduce((a, s) => a + s.createdOrders, 0),
      totalDoneOrders: series.reduce((a, s) => a + s.doneOrders, 0),
      overallCompletionRate:
        series.reduce((a, s) => a + s.createdOrders, 0) > 0
          ? round2(
              (series.reduce((a, s) => a + s.doneOrders, 0) /
                series.reduce((a, s) => a + s.createdOrders, 0)) *
                100,
            )
          : 0,
    };

    return { dimension: dim, start, end, summary, series };
  }

  // ================ 师傅绩效 ================
  // 接单量/完成率/取消量/收入/评分排行。默认全历史累计，可按时间范围过滤。
  // 评分用 Review 实时聚合（Master.rating 是冗余默认 5.0，无区分度，弃用）。
  async performance(
    params: { start?: string; end?: string; sort?: string; limit?: string } = {},
  ) {
    const { start, end } = this.range(params, 0); // 0 = 全历史
    const sort = params.sort ?? 'revenue';
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 200);

    const [orderRows, settlementRows, reviewRows, masterRows] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          masterId: { not: null },
          deletedAt: null,
          ...(start && end ? { createdAt: { gte: start, lte: end } } : {}),
        },
        select: { masterId: true, status: true },
      }),
      this.prisma.settlement.findMany({
        where: {
          status: SettlementStatus.Credited,
          deletedAt: null,
          ...(start && end ? { settledAt: { gte: start, lte: end } } : {}),
        },
        select: { masterId: true, masterAmount: true },
      }),
      this.prisma.review.findMany({
        where: {
          deletedAt: null,
          ...(start && end ? { createdAt: { gte: start, lte: end } } : {}),
        },
        select: { masterId: true, rating: true },
      }),
      this.prisma.master.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          realName: true,
          city: true,
          user: { select: { phone: true, status: true } },
        },
      }),
    ]);

    type Agg = {
      masterId: string;
      orders: number;
      done: number;
      cancelled: number;
      revenue: number;
      ratingSum: number;
      ratingCount: number;
    };
    const agg = new Map<string, Agg>();
    const touch = (id: string): Agg => {
      let a = agg.get(id);
      if (!a) {
        a = {
          masterId: id,
          orders: 0,
          done: 0,
          cancelled: 0,
          revenue: 0,
          ratingSum: 0,
          ratingCount: 0,
        };
        agg.set(id, a);
      }
      return a;
    };

    for (const o of orderRows) {
      const a = touch(o.masterId!);
      a.orders += 1;
      if (o.status === 'reviewed' || o.status === 'evaluated') a.done += 1;
      if (o.status === 'cancelled') a.cancelled += 1;
    }
    for (const s of settlementRows) {
      const a = touch(s.masterId);
      a.revenue = add2(a.revenue, s.masterAmount);
    }
    for (const r of reviewRows) {
      const a = touch(r.masterId);
      a.ratingSum += r.rating;
      a.ratingCount += 1;
    }

    const masterInfo = new Map(masterRows.map((m) => [m.id, m]));
    const list = [...agg.values()]
      .filter((a) => a.orders > 0 || a.revenue > 0)
      .map((a) => {
        const info = masterInfo.get(a.masterId);
        return {
          masterId: a.masterId,
          realName: info?.realName ?? '—',
          phone: info?.user.phone ?? '—',
          city: info?.city ?? '—',
          status: info?.user.status ?? '—',
          orders: a.orders,
          done: a.done,
          cancelled: a.cancelled,
          completionRate: a.orders ? round2((a.done / a.orders) * 100) : 0,
          revenue: round2(a.revenue),
          rating: a.ratingCount ? round2(a.ratingSum / a.ratingCount) : null,
          reviewCount: a.ratingCount,
        };
      });

    list.sort((x, y) => {
      switch (sort) {
        case 'orders':
          return y.orders - x.orders;
        case 'rating':
          return (y.rating ?? -1) - (x.rating ?? -1);
        case 'completion':
          return y.completionRate - x.completionRate;
        default:
          return y.revenue - x.revenue;
      }
    });

    return { sort, limit, total: list.length, list: list.slice(0, limit) };
  }

  // ================ 用户增长 ================
  // 新增客户/师傅/订单趋势 + 注册转化漏斗（新客户中产生过订单的比例）。
  async growth(params: { dimension?: string; start?: string; end?: string } = {}) {
    const dim = this.normalizeDim(params.dimension);
    const { start, end } = this.range(params, 30);
    const seriesMap = this.initSeries(dim, start, end);

    const [customerRows, masterRows, orderRows, newCustomerIds] = await Promise.all([
      // 新增客户
      this.prisma.user.findMany({
        where: {
          role: Role.Customer,
          deletedAt: null,
          createdAt: { gte: start, lte: end },
        },
        select: { id: true, createdAt: true },
      }),
      // 新增师傅（注册时间）
      this.prisma.user.findMany({
        where: {
          role: Role.Master,
          deletedAt: null,
          createdAt: { gte: start, lte: end },
        },
        select: { createdAt: true },
      }),
      // 新增订单
      this.prisma.order.findMany({
        where: { deletedAt: null, createdAt: { gte: start, lte: end } },
        select: { createdAt: true },
      }),
      // 范围内注册的客户 id（用于转化漏斗）
      this.prisma.user.findMany({
        where: {
          role: Role.Customer,
          deletedAt: null,
          createdAt: { gte: start, lte: end },
        },
        select: { id: true },
      }),
    ]);

    for (const u of customerRows) {
      const s = seriesMap.get(this.bucketOf(dim, u.createdAt).getTime());
      if (s) s.customers += 1;
    }
    for (const u of masterRows) {
      const s = seriesMap.get(this.bucketOf(dim, u.createdAt).getTime());
      if (s) s.masters += 1;
    }
    for (const o of orderRows) {
      const s = seriesMap.get(this.bucketOf(dim, o.createdAt).getTime());
      if (s) s.orders += 1;
    }

    // 转化漏斗：新客户中，已有任意订单（含范围外历史订单，累计转化）的比例
    const ids = newCustomerIds.map((u) => u.id);
    const convertedCustomers = ids.length
      ? await this.prisma.order.findMany({
          where: { customerId: { in: ids }, deletedAt: null },
          select: { customerId: true },
        })
      : [];
    const convertedSet = new Set(convertedCustomers.map((o) => o.customerId));

    const series = [...seriesMap.values()].map((s) => ({
      date: this.formatBucket(dim, s.date),
      customers: s.customers,
      masters: s.masters,
      orders: s.orders,
    }));

    const summary = {
      newCustomers: series.reduce((a, s) => a + s.customers, 0),
      newMasters: series.reduce((a, s) => a + s.masters, 0),
      newOrders: series.reduce((a, s) => a + s.orders, 0),
      convertedCustomers: convertedSet.size,
      conversionRate: ids.length
        ? round2((convertedSet.size / ids.length) * 100)
        : 0,
    };

    return { dimension: dim, start, end, summary, series };
  }

  // ================ 时间分桶工具 ================
  private normalizeDim(dim?: string): BucketDim {
    return dim === 'week' || dim === 'month' ? dim : 'day';
  }

  // 查询范围：start/end 传 ISO 字符串则用；否则默认最近 days 天（0 = 全历史）
  private range(
    params: { start?: string; end?: string },
    days: number,
  ): { start: Date; end: Date } {
    const end = params.end
      ? new Date(params.end)
      : new Date(new Date().getTime() + 24 * 3600 * 1000); // 含今天整天
    const start = params.start
      ? new Date(params.start)
      : days > 0
        ? new Date(end.getTime() - days * 24 * 3600 * 1000)
        : new Date(0);
    return { start, end };
  }

  // 生成桶列表（本地时区对齐）：day=每日0点、week=每周一0点、month=每月1日
  private initSeries(dim: BucketDim, start: Date, end: Date) {
    const map = new Map<number, any>();
    const cursor = this.bucketOf(dim, start);
    while (cursor.getTime() <= end.getTime()) {
      // 注意：必须存 new Date(cursor) 拷贝，否则所有桶共享同一引用，
      // 循环推进 cursor 会把所有桶的日期污染成最后一个值
      map.set(cursor.getTime(), {
        date: new Date(cursor),
        orders: 0,
        gmv: 0,
        refundOrders: 0,
        refundAmount: 0,
        createdOrders: 0,
        doneOrders: 0,
        customers: 0,
        masters: 0,
      });
      if (dim === 'month') {
        cursor.setMonth(cursor.getMonth() + 1); // 跳到下月（1 日不变）
      } else {
        cursor.setDate(cursor.getDate() + (dim === 'day' ? 1 : 7));
      }
    }
    return map;
  }

  // 任意时间对齐到所属桶的起始
  private bucketOf(dim: BucketDim, d: Date): Date {
    const y = d.getFullYear();
    const m = d.getMonth();
    if (dim === 'month') return new Date(y, m, 1);
    const day = d.getDate();
    if (dim === 'day') return new Date(y, m, day);
    // week：对齐到周一
    const dow = (d.getDay() + 6) % 7; // 周一=0 ... 周日=6
    return new Date(y, m, day - dow);
  }

  private formatBucket(dim: BucketDim, d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    if (dim === 'month') return `${d.getFullYear()}-${p(d.getMonth() + 1)}`;
    if (dim === 'week')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}周`;
    return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}
