import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, OrderStatus } from '@laoma/shared';

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

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // 工作台聚合统计：今日订单/待接订单/在线师傅/本月GMV/本月平台净收入
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

    const [todayOrders, pendingOrders, onlineMasters, gmvResult, revenueResult] =
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
            status: 'credited',
            settledAt: { gte: startOfMonth },
            deletedAt: null,
          },
          _sum: { platformFee: true },
        }),
      ]);

    return {
      todayOrders,
      pendingOrders,
      onlineMasters,
      monthlyGMV: Number(gmvResult._sum.amount ?? 0),
      monthlyPlatformRevenue: Number(revenueResult._sum.platformFee ?? 0),
    };
  }
}
