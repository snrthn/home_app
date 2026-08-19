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
import { OrdersGateway } from '../gateway/orders.gateway';
import { SettlementsService } from '../settlements/settlements.service';
import { PaymentsService } from '../payments/payments.service';
import { CommissionService } from '../commission/commission.service';

function genOrderNo() {
  return (
    'LM' +
    Date.now().toString(36).toUpperCase() +
    Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')
  );
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

  async create(customerId: string, dto: any) {
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

  // 师傅「所在地 ∪ 接单范围」是否覆盖订单地址（接单池过滤/抢单校验 共用）。
  // 严格模式：两者皆空 → 不覆盖（pool 返回 []、grab throw）。
  // code-only 匹配（撤掉名称兜底，避免「市辖区」跨城市误命中）。
  private masterCoversOrder(
    master:
      | {
          serviceAreas?: any;
          provinceCode?: string | null;
          cityCode?: string | null;
          districtCode?: string | null;
        }
      | null,
    addr:
      | {
          provinceCode?: string | null;
          cityCode?: string | null;
          districtCode?: string | null;
        }
      | null
      | undefined,
  ): boolean {
    const areas = (master?.serviceAreas as any[]) ?? [];
    const home = master?.provinceCode
      ? [
          {
            provinceCode: master.provinceCode,
            cityCode: master.cityCode,
            districtCode: master.districtCode,
          },
        ]
      : [];
    const rules = [...areas, ...home];
    if (rules.length === 0) return false;
    return regionMatches(rules, {
      provinceCode: addr?.provinceCode,
      cityCode: addr?.cityCode,
      districtCode: addr?.districtCode,
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
    // 地域匹配：所在地 ∪ 接单范围 并集判定（与公告过滤语义一致）。
    // 两者皆空才视为「未配置」严格不可见。
    const master = await this.prisma.master.findUnique({
      where: { userId: masterId },
      select: { serviceAreas: true, provinceCode: true, cityCode: true, districtCode: true },
    });
    return orders.filter((o) => this.masterCoversOrder(master, o.address));
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
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: to, ...(extraData ?? {}) },
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
    this.gateway?.broadcastOrderUpdate(updated);
    // 订单离开接单态（被接走/取消）：通知接单池刷新移除
    if (order.status === OrderStatus.PendingAccept && to !== OrderStatus.PendingAccept) {
      this.gateway?.broadcastPoolUpdate(updated);
    }
    return updated;
  }

  async grab(orderId: string, userId: string) {
    const mid = await this.masterIdOf(userId);
    // 区域二次校验：师傅必须覆盖订单地址才能抢单（与接单池过滤同口径）。
    // 防止池子外直接调 API 越界抢单。
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { address: { select: { provinceCode: true, cityCode: true, districtCode: true } } },
    });
    const master = await this.prisma.master.findUnique({
      where: { userId },
      select: { serviceAreas: true, provinceCode: true, cityCode: true, districtCode: true },
    });
    if (!this.masterCoversOrder(master, order?.address)) {
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
    await this.prisma.order.update({
      where: { id: orderId },
      data: { masterId },
    });
    return this.transition(
      orderId,
      OrderStatus.Accepted,
      adminUserId,
      '管理员指派',
    );
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
