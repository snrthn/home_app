import {
  Injectable,
  Optional,
  Inject,
  forwardRef,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { regionMatches, serviceAreasToRules } from '../common/region-match';
import { OrderStatus } from '@laoma/shared';
import { canTransition } from './order-status';
import { masterCoversOrder, slotsOverlap } from './master.util';
import { OrdersGateway } from '../gateway/orders.gateway';
import { SettlementsService } from '../settlements/settlements.service';
import { PaymentsService } from '../payments/payments.service';
import { CommissionService } from '../commission/commission.service';
import type { CreateOrderDto } from './orders.dto';
import { randomUUID } from 'node:crypto';

function genOrderNo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `LM${ts}${rand}`;
}

// 支付后（含平台托管）的状态：这些阶段取消都需走退款
const POST_PAY_STATES = [
  OrderStatus.PendingAccept,
  OrderStatus.Accepted,
  OrderStatus.Departing,
  OrderStatus.Arrived,
  OrderStatus.Servicing,
  OrderStatus.PendingConfirm,
];

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private settlements: SettlementsService,
    @Inject(forwardRef(() => PaymentsService))
    private payments: PaymentsService,
    private commission: CommissionService,
    @Optional() private gateway?: OrdersGateway,
  ) {}

  private async masterIdOf(userId: string) {
    const m = await this.prisma.master.findUnique({ where: { userId } });
    if (!m) throw new BadRequestException('当前账号不是师傅');
    return m.id;
  }

  private async masterIdOfSafe(userId: string): Promise<string | null> {
    const m = await this.prisma.master.findUnique({ where: { userId } });
    return m?.id ?? null;
  }

  async create(customerId: string, dto: CreateOrderDto) {
    const item = await this.prisma.serviceItem.findUnique({
      where: { id: dto.serviceItemId },
    });
    if (!item || !item.isActive) throw new NotFoundException('服务项不存在');
    const addr = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId: customerId },
    });
    if (!addr) throw new NotFoundException('地址不存在');

    // 地域闸门（P0）：下单地址必须在平台已开通的服务区域内，堵「未开通城市下单成死单」。
    // 命中规则集任一即可见（省→通配全省、市→通配全市、区→精确到区）。
    const areas = await this.prisma.serviceArea.findMany({
      where: { isActive: true, deletedAt: null },
      select: { level: true, provinceCode: true, cityCode: true, districtCode: true },
    });
    const rules = serviceAreasToRules(areas);
    if (
      rules.length === 0 ||
      !regionMatches(rules, {
        provinceCode: addr.provinceCode,
        cityCode: addr.cityCode,
        districtCode: addr.districtCode,
      })
    ) {
      throw new BadRequestException('该区域暂未开通服务');
    }

    // 分账规则快照（R-新4 同款思路）：下单时按 服务项→类目树→全局 解析并固化，
    // 之后退款/结算只读快照，后期调整类目佣金不会污染历史订单。
    const commissionSnapshot = await this.commission.resolve(dto.serviceItemId);

    // 幂等去重：同一客户对同一服务项+地址+预约时段，5 分钟内不重复创建
    const dedupSince = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await this.prisma.order.findFirst({
      where: {
        customerId,
        serviceItemId: dto.serviceItemId,
        addressId: dto.addressId,
        status: OrderStatus.PendingPayment,
        createdAt: { gte: dedupSince },
        ...(dto.appointmentDate ? { appointmentDate: new Date(dto.appointmentDate) } : {}),
        ...(dto.appointmentSlot ? { appointmentSlot: dto.appointmentSlot } : {}),
      },
    });
    if (existing) return existing;

    // 下单即进入「待支付」态（支付前置模型）；支付成功后再入抢单池。
    const order = await this.prisma.order.create({
      data: {
        orderNo: genOrderNo(),
        customerId,
        addressId: dto.addressId,
        serviceItemId: dto.serviceItemId,
        serviceSnapshot: item as any,
        commissionSnapshot: commissionSnapshot as any,
        city: addr.city,
        amount: item.price,
        appointmentDate: dto.appointmentDate ? new Date(dto.appointmentDate) : null,
        appointmentSlot: dto.appointmentSlot,
        remark: dto.remark,
        customerPhotos: dto.photos ?? undefined,
        status: OrderStatus.PendingPayment,
      },
    });
    return order;
  }

  async listForCustomer(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        serviceItem: true,
        master: {
          include: {
            user: { select: { phone: true, profile: { select: { nickname: true } } } },
          },
        },
        address: true,
        // 一单一评（orderId unique）：带上评价供前端判断是否已评价、渲染评价卡片
        review: {
          select: { rating: true, comment: true, anonymous: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pool(masterId?: string) {
    // masterId:null 与抢单乐观锁条件对齐：抢单先占 masterId 再流转，
    // 中途异常会留下 PendingAccept+已占 的孤儿单，池子里不该再展示
    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.PendingAccept, masterId: null },
      include: { serviceItem: true, address: true },
    });
    // 未带师傅上下文（理论上 Guard 已保证，这里兜底宽松）：返回全部
    if (!masterId) return orders;
    const master = await this.prisma.master.findUnique({
      where: { userId: masterId },
      select: { status: true, serviceAreas: true, provinceCode: true, cityCode: true, districtCode: true },
    });
    if (master?.status !== 'active') return [];
    return orders.filter((o) => masterCoversOrder(master, o.address));
  }

  async listForMaster(userId: string, city?: string) {
    const mid = await this.masterIdOf(userId);
    return this.prisma.order.findMany({
      where: { masterId: mid, ...(city ? { city } : {}) },
      include: {
        serviceItem: true,
        address: true,
        customer: { select: { phone: true, profile: { select: { nickname: true } } } },
        // 师傅视角的订单评价（客户对本单的评分/评论；select 不含 customerId，匿名与否由前端按 anonymous 标记处理）
        review: {
          select: { rating: true, comment: true, anonymous: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll() {
    return this.prisma.order.findMany({
      include: {
        serviceItem: true,
        customer: { select: { phone: true, profile: { select: { nickname: true } } } },
        master: { include: { user: { select: { phone: true, profile: { select: { nickname: true } } } } } },
        address: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 订单状态机执行器（全局唯一）：
   * 统一做 canTransition 校验 + 写库 + 统一日志 + 实时广播。
   * 评价(reviews)、退款(payments) 等业务动作统一复用本方法，不再各自手写 update+broadcast。
   * @param action 写入 orderLog 的语义动作，默认 'transition'；评价传 'review'、退款传 'refund'，保留业务语义便于后台追溯。
   */
  public async transition(
    orderId: string,
    to: OrderStatus,
    actorId?: string,
    note?: string,
    extraData?: { cancelReason: string },
    action = 'transition',
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (!canTransition(order.status, to))
      throw new BadRequestException(
        `状态不可从 ${order.status} 流转到 ${to}`,
      );
    // 乐观锁：仅当当前状态与读取时一致才更新，防止并发流转绕过状态机
    const locked = await this.prisma.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: to, ...(extraData ?? {}) },
    });
    if (locked.count === 0)
      throw new BadRequestException('订单状态已被并发修改，请刷新后重试');
    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { address: true },
    });
    await this.prisma.orderLog.create({
      data: {
        orderId,
        action,
        fromStatus: order.status,
        toStatus: to,
        operatorId: actorId,
        note,
      },
    });
    this.gateway?.broadcastOrderUpdate(updated!);
    // 订单离开接单态（被接走/取消）：通知接单池刷新移除
    if (order.status === OrderStatus.PendingAccept && to !== OrderStatus.PendingAccept) {
      this.gateway?.broadcastPoolUpdate(updated!);
    }
    return updated!;
  }

  async grab(orderId: string, userId: string) {
    const mid = await this.masterIdOf(userId);
    const master = await this.prisma.master.findUnique({
      where: { userId },
      select: { status: true, serviceAreas: true, provinceCode: true, cityCode: true, districtCode: true },
    });
    if (master?.status !== 'active') {
      throw new ForbiddenException('账号尚未通过审核，无法接单');
    }
    // 区域二次校验：师傅必须覆盖订单地址才能抢单（与接单池过滤同口径）。
    // 防止池子外直接调 API 越界抢单。
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { address: { select: { provinceCode: true, cityCode: true, districtCode: true } } },
    });
    if (!masterCoversOrder(master, order?.address)) {
      throw new BadRequestException('您不在该订单的服务区域');
    }
    // 乐观锁：仅当订单处于「待接单」且尚无师傅接走(masterId=null)时原子抢占，
    // 避免并发被多师傅同时抢走（第二个抢单者 count=0 即失败）。
    const locked = await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PendingAccept, masterId: null },
      data: { masterId: mid },
    });
    if (locked.count === 0)
      throw new BadRequestException('手慢了，该订单已被其他师傅接走');
    return this.transition(orderId, OrderStatus.Accepted, userId, '师傅抢单');
  }

  async assign(orderId: string, masterId: string, adminUserId: string) {
    // 乐观锁：仅当订单仍为待接单且无师傅时才原子占位，与 grab() 同口径
    const locked = await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PendingAccept, masterId: null },
      data: { masterId },
    });
    if (locked.count === 0)
      throw new BadRequestException('该订单已被接走或不在待接单状态');
    return this.transition(
      orderId,
      OrderStatus.Accepted,
      adminUserId,
      '管理员指派',
    );
  }

  // 在手中订单状态（用于负载统计）
  private static readonly ACTIVE_STATUSES: OrderStatus[] = [
    OrderStatus.Accepted,
    OrderStatus.Departing,
    OrderStatus.Arrived,
    OrderStatus.Servicing,
    OrderStatus.PendingConfirm,
  ];

  /**
   * 智能派单：为指定订单推荐候选师傅。
   * 匹配算法：区域硬过滤（masterCoversOrder）→ 技能软加分（含祖先链）→ 预约冲突降权 → 负载排序。
   * 仅 PendingAccept + masterId:null 的订单才推荐（已被接走的不推荐）。
   */
  async listCandidates(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        address: true,
        serviceItem: { select: { categoryId: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== OrderStatus.PendingAccept || order.masterId) {
      throw new BadRequestException('该订单不在待接单状态');
    }

    const categoryId = order.serviceItem?.categoryId;

    // 祖先链：categoryId 沿 parent 向上收集（含自身），Map<id, name>，用于技能匹配
    const ancestors = new Map<string, string>();
    if (categoryId) {
      let cur = await this.prisma.serviceCategory.findUnique({
        where: { id: categoryId },
        select: { id: true, parentId: true, name: true },
      });
      while (cur) {
        if (!ancestors.has(cur.id)) ancestors.set(cur.id, cur.name);
        if (!cur.parentId) break;
        cur = await this.prisma.serviceCategory.findUnique({
          where: { id: cur.parentId },
          select: { id: true, parentId: true, name: true },
        });
      }
    }

    // 查全部 active 师傅
    const masters = await this.prisma.master.findMany({
      where: { status: 'active', deletedAt: null },
      select: {
        id: true,
        realName: true,
        userId: true,
        serviceAreas: true,
        skills: true,
        provinceCode: true,
        cityCode: true,
        districtCode: true,
        rating: true,
        orderCount: true,
        user: { select: { phone: true } },
      },
    });

    // 区域硬过滤
    const covered = masters.filter((m) => masterCoversOrder(m, order.address));
    if (covered.length === 0) return [];

    const coveredIds = covered.map((m) => m.id);

    // 批量查在手中订单数（一次 groupBy，避免 N+1）
    const activeCounts = await this.prisma.order.groupBy({
      by: ['masterId'],
      where: {
        masterId: { in: coveredIds },
        status: { in: OrdersService.ACTIVE_STATUSES },
      },
      _count: { _all: true },
    });
    const countMap = new Map<string, number>(
      activeCounts.map((r) => [r.masterId!, r._count._all]),
    );

    // 预约冲突：目标订单有预约日期时，查候选师傅 active 订单同日预约，slot 重叠即冲突（降权不排除）
    const conflictMap = new Map<string, { orderNo: string; slot: string | null }>();
    if (order.appointmentDate) {
      const dayStart = new Date(order.appointmentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const sameDay = await this.prisma.order.findMany({
        where: {
          masterId: { in: coveredIds },
          status: { in: OrdersService.ACTIVE_STATUSES },
          appointmentDate: { gte: dayStart, lt: dayEnd },
          id: { not: orderId },
        },
        select: { masterId: true, orderNo: true, appointmentSlot: true },
      });
      for (const o of sameDay) {
        if (!o.masterId) continue;
        if (slotsOverlap(order.appointmentSlot, o.appointmentSlot)) {
          if (!conflictMap.has(o.masterId)) {
            conflictMap.set(o.masterId, { orderNo: o.orderNo, slot: o.appointmentSlot });
          }
        }
      }
    }

    // 组装推荐列表 + 排序
    const candidates = covered.map((m) => {
      const skills = (m.skills as string[]) ?? [];
      // 技能命中：优先精确命中 categoryId（exact），否则命中祖先类目（ancestor，父类目覆盖）
      let skillMatch = false;
      let skillMatchDetail: 'exact' | 'ancestor' | null = null;
      let matchedCategoryName: string | null = null;
      if (categoryId && skills.length > 0) {
        if (skills.includes(categoryId)) {
          skillMatch = true;
          skillMatchDetail = 'exact';
          matchedCategoryName = ancestors.get(categoryId) ?? null;
        } else {
          const hit = skills.find((s) => ancestors.has(s));
          if (hit) {
            skillMatch = true;
            skillMatchDetail = 'ancestor';
            matchedCategoryName = ancestors.get(hit) ?? null;
          }
        }
      }
      const conflict = conflictMap.get(m.id);
      return {
        masterId: m.id,
        realName: m.realName,
        phone: m.user?.phone ?? null,
        skillMatch,
        skillMatchDetail,
        matchedCategoryName,
        conflict: !!conflict,
        conflictOrderNo: conflict?.orderNo ?? null,
        activeOrderCount: countMap.get(m.id) ?? 0,
        rating: Number(m.rating),
        orderCount: m.orderCount,
      };
    });

    // 排序：技能匹配 DESC → 无冲突 ASC（降权不排除）→ 在手单数 ASC → 评分 DESC → 经验 DESC
    candidates.sort((a, b) => {
      if (a.skillMatch !== b.skillMatch) return b.skillMatch ? 1 : -1;
      if (a.conflict !== b.conflict) return a.conflict ? 1 : -1;
      if (a.activeOrderCount !== b.activeOrderCount) return a.activeOrderCount - b.activeOrderCount;
      if (a.rating !== b.rating) return b.rating - a.rating;
      return b.orderCount - a.orderCount;
    });

    return candidates;
  }

  /**
   * 派单看板统计（Phase 2，docs/dispatch-design.md §3.4）：实时查询，无新表。
   * 口径：avgAcceptMinutes = (Accepted 的 orderLog.createdAt − order.createdAt) 近 7 日均值；
   * Order 无独立「入池时间」字段，用 createdAt（支付完成后入池）近似。
   */
  async dispatchStats() {
    const now = new Date();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const timeoutMs = Number(process.env.AUTO_DISPATCH_TIMEOUT_MS ?? 30 * 60 * 1000);
    const autoDispatchEnabled = (process.env.AUTO_DISPATCH_ENABLED ?? 'true') !== 'false';

    const [pending, activeMasterCount, todayCreated, acceptedLogs] = await Promise.all([
      // 待派单（PendingAccept + masterId:null）
      this.prisma.order.findMany({
        where: { status: OrderStatus.PendingAccept, masterId: null },
        select: { id: true, createdAt: true },
      }),
      // 在岗师傅数
      this.prisma.master.count({ where: { status: 'active', deletedAt: null } }),
      // 今日新单
      this.prisma.order.count({ where: { createdAt: { gte: dayStart } } }),
      // 近 7 日「待接 → 已接」的流转记录（用于今日已派 + 平均接单时长）
      this.prisma.orderLog.findMany({
        where: {
          action: 'transition',
          fromStatus: OrderStatus.PendingAccept,
          toStatus: OrderStatus.Accepted,
          createdAt: { gte: weekAgo },
        },
        select: { orderId: true, createdAt: true },
      }),
    ]);

    const overdueCount = pending.filter(
      (o) => now.getTime() - o.createdAt.getTime() > timeoutMs,
    ).length;
    const todayAssigned = acceptedLogs.filter((l) => l.createdAt >= dayStart).length;

    // 平均接单时长：Accepted log 时间 − 订单 createdAt
    const orderIds = [...new Set(acceptedLogs.map((l) => l.orderId))];
    const orders = orderIds.length
      ? await this.prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, createdAt: true },
        })
      : [];
    const orderMap = new Map(orders.map((o) => [o.id, o.createdAt]));
    const diffs: number[] = [];
    for (const l of acceptedLogs) {
      const oc = orderMap.get(l.orderId);
      if (oc) diffs.push(Math.max(0, (l.createdAt.getTime() - oc.getTime()) / 60000));
    }
    const avgAcceptMinutes = diffs.length
      ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
      : 0;

    return {
      pendingCount: pending.length,
      overdueCount,
      timeoutMs,
      autoDispatchEnabled,
      activeMasterCount,
      todayCreated,
      todayAssigned,
      avgAcceptMinutes,
    };
  }

  /**
   * 超时自动派单（Phase 2，docs/dispatch-design.md §3.5）：扫描超时未接订单，
   * 取推荐第一名自动指派（actorId='system'，与管理员指派可区分）。
   * 幂等：并发已被接走的单由 listCandidates 抛错捕获跳过；无覆盖师傅跳过；
   * 预约单（appointmentDate 非空）豁免，留给人工处理。
   */
  async autoDispatchOverdue() {
    if ((process.env.AUTO_DISPATCH_ENABLED ?? 'true') === 'false') {
      return { dispatched: 0, skipped: 0, disabled: true };
    }
    const timeoutMs = Number(process.env.AUTO_DISPATCH_TIMEOUT_MS ?? 30 * 60 * 1000);
    const due = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PendingAccept,
        masterId: null,
        createdAt: { lt: new Date(Date.now() - timeoutMs) },
        appointmentDate: null,
      },
      select: { id: true, orderNo: true },
    });
    let dispatched = 0;
    let skipped = 0;
    for (const o of due) {
      try {
        const cands = await this.listCandidates(o.id);
        const top = cands[0];
        if (!top) {
          skipped++;
          continue;
        }
        await this.assign(o.id, top.masterId, 'system');
        dispatched++;
      } catch {
        skipped++;
      }
    }
    return { dispatched, skipped, disabled: false };
  }

  /** 师傅出发上门：已接单 → 出发上门中 */
  async depart(orderId: string, userId: string) {
    const mid = await this.masterIdOf(userId);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order?.masterId !== mid)
      throw new ForbiddenException('只能操作自己接的单');
    return this.transition(orderId, OrderStatus.Departing, userId, '师傅出发上门');
  }

  /** 客户生成到达验证码：师傅出发后，客户生成 6 位码供师傅到现场输入 */
  async generateArriveCode(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.customerId !== userId)
      throw new ForbiddenException('无权操作该订单');
    if (order.status !== OrderStatus.Departing)
      throw new BadRequestException('师傅出发后才能生成到达验证码');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.order.update({
      where: { id: orderId },
      data: { arriveCode: code },
    });
    return { code };
  }

  /** 师傅确认到达：输入客户出示的验证码，校验通过后 departing → arrived */
  async arrive(orderId: string, userId: string, code: string) {
    const mid = await this.masterIdOf(userId);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.masterId !== mid)
      throw new ForbiddenException('只能操作自己接的单');
    if (order.status !== OrderStatus.Departing)
      throw new BadRequestException('当前状态不可确认到达');
    if (!order.arriveCode)
      throw new BadRequestException('客户尚未生成到达验证码，请提醒客户生成');
    if (order.arriveCode !== code.trim())
      throw new BadRequestException('验证码不正确');
    const updated = await this.transition(
      orderId,
      OrderStatus.Arrived,
      userId,
      '师傅确认到达（验证码校验通过）',
    );
    // 验证通过后清除验证码（一次性消费）
    await this.prisma.order.update({
      where: { id: orderId },
      data: { arriveCode: null },
    });
    return updated;
  }

  async startService(orderId: string, userId: string) {
    const mid = await this.masterIdOf(userId);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order?.masterId !== mid)
      throw new ForbiddenException('只能操作自己接的单');
    return this.transition(orderId, OrderStatus.Servicing, userId, '开始服务');
  }

  async complete(orderId: string, userId: string) {
    const mid = await this.masterIdOf(userId);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order?.masterId !== mid)
      throw new ForbiddenException('只能操作自己接的单');
    return this.transition(
      orderId,
      OrderStatus.PendingConfirm,
      userId,
      '完成服务',
    );
  }

  /** 客户验收：待验收 → 已评价，并释放平台托管金给师傅（结算台账） */
  async confirm(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.customerId !== userId)
      throw new ForbiddenException('无权操作该订单');
    const updated = await this.transition(
      orderId,
      OrderStatus.Reviewed,
      userId,
      '客户验收完成',
    );
    await this.settlements.releaseToMaster(orderId);
    return updated;
  }

  /** 取消：需填写取消原因（必填，写入 orderLog）；支付前取消无退款；支付后取消走阶梯退款。
   *  退款比例与三方分账不再硬编码，改由订单快照 commissionSnapshot 决定
   *  （解析优先级：服务项 → 类目树 → 全局默认，见 CommissionService）。 */
  async cancel(orderId: string, userId: string, isAdmin = false, reason = '') {
    const r = (reason ?? '').trim();
    if (!r) throw new BadRequestException('请填写取消原因');
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const isCustomer = order.customerId === userId;
    const mid = await this.masterIdOfSafe(userId);
    const isMaster = !!mid && order.masterId === mid;
    if (!isCustomer && !isMaster && !isAdmin)
      throw new ForbiddenException('无权取消该订单');

    if (POST_PAY_STATES.includes(order.status as OrderStatus)) {
      // 阶梯依据必须是「流转到 refunding 之前」的状态，故先留存再传给退款
      const stageStatus = order.status as string;
      await this.transition(
        orderId,
        OrderStatus.Refunding,
        userId,
        `取消（发起退款）｜原因：${r}`,
        { cancelReason: r },
      );
      await this.payments.refund(order.customerId, orderId, stageStatus);
      return this.prisma.order.findUnique({ where: { id: orderId } });
    }
    return this.transition(
      orderId,
      OrderStatus.Cancelled,
      userId,
      `取消｜原因：${r}`,
      { cancelReason: r },
    );
  }
}
