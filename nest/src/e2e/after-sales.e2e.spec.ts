import request from 'supertest';
import { OrderStatus } from '@laoma/shared';
import {
  bootstrapApp,
  createE2EContext,
  cleanupE2EContext,
  createAndCompleteOrder,
  E2EContext,
} from './setup';

describe('售后链 e2e — 投诉→审核→退款/补偿', () => {
  let ctx: E2EContext;
  let orderA: string; // 用于退款流程
  let orderB: string; // 用于补偿流程
  let ticketA: string;
  let ticketB: string;
  let refundId: string;

  beforeAll(async () => {
    const app = await bootstrapApp();
    ctx = await createE2EContext(app);
    // 走完两单正向全链，拿到 reviewed 订单
    orderA = await createAndCompleteOrder(ctx);
    orderB = await createAndCompleteOrder(ctx);
  }, 120000);

  afterAll(async () => {
    if (ctx) {
      await cleanupE2EContext(ctx);
      await ctx.app.close();
    }
  }, 30000);

  // ========== 退款流程 ==========

  it('A1. 客户创建投诉工单 → open', async () => {
    const res = await request(ctx.server)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({
        type: 'complaint',
        orderId: orderA,
        title: '服务态度差',
        content: '师傅态度恶劣且迟到一个小时',
        reason: 'attitude',
        expectation: '退款',
        againstMasterId: ctx.masterId,
      });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('complaint');
    expect(res.body.status).toBe('open');
    expect(res.body.complaint.reason).toBe('attitude');
    ticketA = res.body.id;
  });

  it('A2. 管理员处置投诉(result=refund) → 退款申请 pending_review', async () => {
    const res = await request(ctx.server)
      .post(`/api/tickets/${ticketA}/complaint/resolve`)
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({ result: 'refund' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('resolved');

    const refund = await ctx.prisma.refund.findFirst({
      where: { orderId: orderA, ticketId: ticketA },
    });
    expect(refund).not.toBeNull();
    expect(refund!.status).toBe('pending_review');
    refundId = refund!.id;
  });

  it('A3. 管理员审核通过退款 → 订单 refunded + 全额退款（reviewed 不在阶梯断点中）', async () => {
    const res = await request(ctx.server)
      .post(`/api/payments/refunds/${refundId}/approve`)
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({ note: '投诉属实，同意退款' });
    expect(res.status).toBe(201);

    const order = await ctx.prisma.order.findUnique({ where: { id: orderA } });
    expect(order?.status).toBe(OrderStatus.Refunded);

    const refund = await ctx.prisma.refund.findUnique({ where: { id: refundId } });
    expect(refund!.status).toBe('approved');
    // reviewed 不在 CANCELLABLE_LIFECYCLE 中 → resolveTierRatio 返回 1（全额退）
    expect(Number(refund!.refundedAmount)).toBe(Number(order!.amount));

    // 全额退 → masterCompensation=0 → 无补偿单
    const comp = await ctx.prisma.settlement.findFirst({
      where: { orderId: orderA, type: 'compensation' },
    });
    expect(comp).toBeNull();

    // 正常结算单（验收时生成的）仍然存在
    const normal = await ctx.prisma.settlement.findFirst({
      where: { orderId: orderA, type: 'normal' },
    });
    expect(normal).not.toBeNull();
    expect(normal!.status).toBe('credited');
  });

  // ========== 补偿流程 ==========

  it('B1. 客户创建第二单投诉 → open', async () => {
    const res = await request(ctx.server)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({
        type: 'complaint',
        orderId: orderB,
        title: '服务造成损失',
        content: '师傅操作不当导致设备损坏',
        reason: 'damage',
        expectation: '补偿',
        againstMasterId: ctx.masterId,
      });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('complaint');
    expect(res.body.complaint.reason).toBe('damage');
    ticketB = res.body.id;
  });

  it('B2. 管理员处置投诉(result=compensate) → 工单 resolved, complaint.result=compensate', async () => {
    const res = await request(ctx.server)
      .post(`/api/tickets/${ticketB}/complaint/resolve`)
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({ result: 'compensate' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('resolved');

    // 投诉记录已更新：result=compensate，由管理员处置
    const complaint = await ctx.prisma.complaint.findUnique({
      where: { ticketId: ticketB },
    });
    expect(complaint!.result).toBe('compensate');
    expect(complaint!.handledById).toBe(ctx.adminUserId);

    // compensate 时 masterCompensation=0 → createCompensation 返回 null，
    // 不创建补偿结算单（orderId @unique 约束也阻止了第二张结算单）
    const comp = await ctx.prisma.settlement.findFirst({
      where: { orderId: orderB, type: 'compensation' },
    });
    expect(comp).toBeNull();

    // 正常结算单不受影响（师傅所得仍在）
    const normal = await ctx.prisma.settlement.findFirst({
      where: { orderId: orderB, type: 'normal' },
    });
    expect(normal).not.toBeNull();
    expect(normal!.status).toBe('credited');
  });
});
