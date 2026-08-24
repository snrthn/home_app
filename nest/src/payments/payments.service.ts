import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MerchantConfigStore,
  type MerchantConfig,
} from './merchant-config.store';
import { MockPaymentProvider } from './mock.provider';
import { WechatPaymentProvider } from './wechat.provider';
import { AlipayPaymentProvider } from './alipay.provider';
import type { PaymentProvider, PaymentProviderName } from './provider';
import { OrderStatus } from '@laoma/shared';
import { OrdersGateway } from '../gateway/orders.gateway';
import { SettlementsService } from '../settlements/settlements.service';
import { CommissionService } from '../commission/commission.service';
import { OrdersService } from '../orders/orders.service';

// 支付后（平台托管）可退款的状态，须与 orders.service 的同名常量保持一致，
// 否则直接调用退款接口时 departing/arrived 会被误判为「不可退款」。
const POST_PAY_STATES = [
  OrderStatus.PendingAccept,
  OrderStatus.Accepted,
  OrderStatus.Departing,
  OrderStatus.Arrived,
  OrderStatus.Servicing,
  OrderStatus.PendingConfirm,
];

export interface RefundListFilter {
  status?: string;
  orderNo?: string;
}

@Injectable()
export class PaymentsService {
  private store = new MerchantConfigStore();
  private mock = new MockPaymentProvider();

  constructor(
    private prisma: PrismaService,
    private gateway: OrdersGateway,
    private settlements: SettlementsService,
    private commission: CommissionService,
    @Inject(forwardRef(() => OrdersService))
    private orders: OrdersService,
  ) {}

  /** 当前启用的支付通道：读 MerchantConfig，enabled 且 provider!=mock 时返回对应真实实现，否则 mock。 */
  async getProvider(): Promise<PaymentProvider> {
    const cfg = await this.store.read();
    if (cfg.enabled && cfg.provider !== 'mock') {
      if (cfg.provider === 'wechat') return new WechatPaymentProvider(cfg);
      if (cfg.provider === 'alipay') return new AlipayPaymentProvider(cfg);
    }
    return this.mock;
  }

  /** 后台读取商户配置（脱敏，不含明文密钥） */
  async getConfig(): Promise<MerchantConfig> {
    const cfg = await this.store.read();
    return this.mask(cfg);
  }

  private mask(cfg: MerchantConfig): MerchantConfig {
    const out: MerchantConfig = { ...cfg };
    delete out.appSecret;
    delete out.apiKey;
    delete out.certContent;
    return out;
  }

  /** 后台保存商户配置（敏感字段加密落盘） */
  async saveConfig(dto: MerchantConfig): Promise<MerchantConfig> {
    return this.store.write(dto);
  }

  /** 确保该订单存在一条 pending 支付单（幂等） */
  private async ensurePayment(
    order: { id: string; customerId: string; masterId: string | null; amount: any },
    qrType: string,
  ) {
    const exist = await this.prisma.payment.findFirst({ where: { orderId: order.id } });
    if (exist) {
      await this.prisma.payment.update({
        where: { id: exist.id },
        data: { qrType, amount: order.amount, status: 'pending' },
      });
      return exist;
    }
    return this.prisma.payment.create({
      data: {
        orderId: order.id,
        customerId: order.customerId ?? '',
        masterId: order.masterId ?? null,
        qrType,
        amount: order.amount,
        status: 'pending',
      },
    });
  }

  /** 客户发起支付：预创建支付单，返回调起参数 */
  async charge(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.customerId !== customerId)
      throw new ForbiddenException('无权操作该订单');
    if (order.status !== OrderStatus.PendingPayment)
      throw new BadRequestException('该订单当前不可支付（需处于待支付态）');

    const provider = await this.getProvider();
    const res = await provider.createCharge({
      orderId: order.id,
      orderNo: order.orderNo,
      amount: Number(order.amount),
      subject: (order.serviceSnapshot as any)?.name ?? '家政服务',
      customerId,
    });

    await this.ensurePayment(order, provider.name);

    return { provider: provider.name, payParams: res.payParams };
  }

  /** 模拟通道回调：前端点「模拟支付成功」调用，等价于真实通道的异步 notify */
  async mockNotify(orderId: string, token: string) {
    const provider = await this.getProvider();
    const result = await provider.verifyNotify({ orderId, token });
    if (!result.success) throw new BadRequestException('模拟支付校验失败');
    return this.applyPaid(orderId, result.tradeNo);
  }

  /** 真实通道异步回调入口：由 /payments/notify/:provider 路由调用，按配置解析并落账 */
  async handleNotify(providerName: PaymentProviderName, payload: any) {
    const provider = await this.getProvider();
    const result = await provider.verifyNotify(payload);
    if (!result.success) return;
    await this.applyPaid(result.orderId, result.tradeNo);
  }

  /** 支付成功 → 平台托管：订单置「待接单」，资金进入托管（验收后由结算释放给师傅） */
  private async applyPaid(orderId: string, tradeNo?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== OrderStatus.PendingPayment) return; // 幂等

    await this.prisma.payment.updateMany({
      where: { orderId },
      data: { status: 'paid', paidAt: new Date() },
    });
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PendingAccept },
      include: { address: true }, // 带上地址地域，供网关按区域投递新单
    });
    await this.prisma.orderLog.create({
      data: {
        orderId,
        action: 'pay',
        fromStatus: OrderStatus.PendingPayment,
        toStatus: OrderStatus.PendingAccept,
        note: '客户支付成功（平台托管）',
      },
    });
    // 支付成功入池：实时推送给在线师傅端（网关已挂入，非 mock 场景亦生效）
    this.gateway?.broadcastNewOrder(updated);
  }

  /** 退款：支付后取消时调用，退款完成后置「已退款」。
   *  金额与三方分账（退用户 / 平台留成 / 师傅补偿）全部由订单快照
   *  Order.commissionSnapshot 决定（下单时固化，历史单实时解析兜底），不再硬编码比例。
   *  stageStatus：发起取消时的原始订单状态（orders.cancel 会先流转到 refunding，
   *  阶梯依据必须用流转前的状态，故由调用方显式传入）。
   *  opts.allowCompleted：投诉处置审核通过场景放行已完单（reviewed/evaluated），
   *  此时订单状态机出口（→ refunding）也已同步放行，见 docs/refund-aftersale-design.md 第 3 节。
   *  opts.reason：退款原因（默认「订单取消退款」；投诉场景传投诉原因/期望）。
   */
  async refund(
    customerId: string,
    orderId: string,
    stageStatus?: string,
    opts?: { allowCompleted?: boolean; reason?: string },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.customerId !== customerId)
      throw new ForbiddenException('无权操作该订单');
    // 允许：支付后托管阶段(pending_accept..pending_confirm) 主动退款；
    // 也允许 orders.cancel 已先行流转到 refunding 的场景（幂等退款）；
    // allowCompleted=true 时额外放行已完单（reviewed/evaluated，仅投诉处置审核通过场景）
    const REFUNDABLE_STATES = [...POST_PAY_STATES, OrderStatus.Refunding];
    const COMPLETED_STATES = [OrderStatus.Reviewed, OrderStatus.Evaluated];
    const refundable =
      REFUNDABLE_STATES.includes(order.status as OrderStatus) ||
      (!!opts?.allowCompleted && COMPLETED_STATES.includes(order.status as OrderStatus));
    if (!refundable)
      throw new BadRequestException('该订单当前不可退款');

    // 按订单快照解析分账规则，一次算清三方金额
    const snap = await this.commission.snapshotFromOrder(order);
    const stage = stageStatus ?? (order.status as string);
    const split = this.commission.splitRefund(Number(order.amount), stage, snap);
    const { refundAmount, refundRatio: ratio, platformKeep, masterCompensation } = split;

    const pay = await this.prisma.payment.findFirst({
      where: { orderId, status: 'paid' },
    });
    const provider = await this.getProvider();
    const refundRes = await provider.refund({
      tradeNo: pay?.id ?? orderId,
      amount: refundAmount,
      originalAmount: Number(order.amount),
      reason: opts?.reason ?? '订单取消退款',
    });

    await this.prisma.payment.updateMany({
      where: { orderId },
      data: { status: 'refunded' },
    });
    const noteRatio = ratio < 1 ? `（实退 ${Math.round(ratio * 100)}%）` : '';
    // 留成拆分写入日志，便于事后对账（谁拿了没退给用户的那部分钱）
    const noteSplit =
      ratio < 1
        ? `｜留成拆分：平台 ¥${platformKeep.toFixed(2)} / 师傅补偿 ¥${masterCompensation.toFixed(2)}｜规则：${snap.source}`
        : '';
    const refundNote =
      `退款完成 ¥${refundAmount.toFixed(2)}${noteRatio} ` +
      refundRes.refundNo +
      noteSplit;
    // 退款完成统一走订单状态机：
    // 两段式收口——先确保经 refunding 中间态（OrdersService.cancel 已先行流转，
    // 此处 order.status 已为 Refunding，跳过第一段），再置 refunded。
    // canTransition 校验 + 统一日志(action='refund') + 实时广播，双端详情页即时可见。
    if (order.status !== OrderStatus.Refunding) {
      await this.orders.transition(
        orderId,
        OrderStatus.Refunding,
        customerId,
        (opts?.reason ?? '取消（发起退款）') + '｜退款流转',
        undefined,
        'refund',
      );
    }
    await this.orders.transition(
      orderId,
      OrderStatus.Refunded,
      customerId,
      refundNote,
      undefined,
      'refund',
    );

    // 留成中属于师傅的部分生成补偿结算单（pending，待管理端审核入账）。
    // 平台留成部分本就在平台账上，无需台账流转，仅记录在补偿单 platformFee 与日志中。
    if (masterCompensation > 0 && order.masterId) {
      await this.settlements.createCompensation(
        orderId,
        masterCompensation,
        platformKeep,
        snap.source,
      );
    }
    return split;
  }

  // ===== 退款单（审核流，管理端「退款/售后」台账，orders:refund） =====
  // 说明：取消单自动退 / 客户端手动退走 refund() 直退，不建单；
  // 仅投诉处置 result=refund 创建退款申请单（pending_review），运营审核通过后执行退款。

  private async nextRefundNo(): Promise<string> {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const count = await this.prisma.refund.count({ where: { createdAt: { gte: todayStart } } });
    return `RF${ymd}${String(count + 1).padStart(4, '0')}`;
  }

  /** 创建退款申请单（投诉处置 result=refund 调用）。同订单已有待审核/已通过单则拒绝重复申请。 */
  async createRefundRequest(dto: {
    ticketId?: string;
    orderId: string;
    amount: number;
    reason?: string;
    requestedBy: string;
  }) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const dup = await this.prisma.refund.findFirst({
      where: { orderId: dto.orderId, status: { in: ['pending_review', 'approved'] } },
    });
    if (dup) throw new BadRequestException('该订单已有退款申请（待审核或已通过）');
    return this.prisma.refund.create({
      data: {
        refundNo: await this.nextRefundNo(),
        orderId: dto.orderId,
        ticketId: dto.ticketId ?? null,
        amount: dto.amount,
        reason: dto.reason ?? null,
        status: 'pending_review',
        requestedById: dto.requestedBy,
      },
    });
  }

  /** 运营主动发起退款：按订单号解析订单，创建退款申请（ticketId 为空，非投诉来源）。 */
  async createRefundByOrderNo(dto: {
    orderNo: string;
    amount?: number;
    reason?: string;
    requestedBy: string;
  }) {
    const order = await this.prisma.order.findFirst({
      where: { orderNo: String(dto.orderNo).trim() },
    });
    if (!order) throw new NotFoundException('订单不存在');
    return this.createRefundRequest({
      ticketId: undefined,
      orderId: order.id,
      amount: dto.amount ?? Number(order.amount),
      reason: dto.reason,
      requestedBy: dto.requestedBy,
    });
  }

  /** 退款台账（管理端）：状态 / 订单号筛选，关联订单、工单、发起人、审核人、结算单。 */
  async listRefunds(filter: RefundListFilter) {
    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    if (filter.orderNo)
      where.order = { orderNo: { contains: String(filter.orderNo).trim() } };
    return this.prisma.refund.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderNo: true,
            amount: true,
            status: true,
            customer: { select: { phone: true, profile: { select: { nickname: true } } } },
          },
        },
        ticket: { select: { id: true, ticketNo: true, title: true } },
        requestedBy: { select: { id: true, phone: true } },
        reviewedBy: { select: { id: true, phone: true } },
        settlement: { select: { id: true, masterAmount: true, status: true } },
      },
    });
  }

  /** 审核退款单：approve → 执行阶梯退款（已完单放行）并回填实退金额 / 补偿结算单；
   *  reject → 置驳回 + 工单内部备注。幂等：仅 pending_review 可审核。 */
  async reviewRefund(
    id: string,
    actorId: string,
    dto: { action: 'approve' | 'reject'; note?: string },
  ) {
    const r = await this.prisma.refund.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!r) throw new NotFoundException('退款单不存在');
    if (r.status !== 'pending_review') throw new BadRequestException('该退款单已审核');

    if (dto.action === 'reject') {
      const updated = await this.prisma.refund.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedById: actorId,
          reviewedAt: new Date(),
          reviewNote: dto.note ?? null,
        },
      });
      // 工单追加内部备注，便于客服回溯（不广播：台账页与工单详情可见即可）
      if (r.ticketId) {
        await this.prisma.ticketComment.create({
          data: {
            ticketId: r.ticketId,
            operatorId: actorId,
            content: `退款申请被驳回${dto.note ? `：${dto.note}` : ''}`,
            isInternal: true,
            visibleTo: 'all',
          },
        });
      }
      return updated;
    }

    // approve：真正执行退款（已完单投诉场景 allowCompleted）。执行失败保持 pending_review 可重试。
    const split = await this.refund(r.order.customerId, r.order.id, r.order.status, {
      allowCompleted: true,
      reason: r.reason ?? '投诉处置退款',
    });
    const comp = await this.prisma.settlement.findFirst({
      where: { orderId: r.order.id, type: 'compensation' },
      orderBy: { createdAt: 'desc' },
    });
    return this.prisma.refund.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedById: actorId,
        reviewedAt: new Date(),
        reviewNote: dto.note ?? null,
        refundedAmount: split.refundAmount,
        settlementId: comp?.id ?? null,
      },
    });
  }

  // ===== 旧二维码凭证支付（保留，与前置支付并存） =====

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
        status: 'paid',
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
