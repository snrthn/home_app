import request from 'supertest';
import { OrderStatus } from '@laoma/shared';
import {
  bootstrapApp,
  createE2EContext,
  cleanupE2EContext,
  E2EContext,
} from './setup';

describe('正向全链 e2e — 下单→支付→抢单→履约→验收→结算', () => {
  let ctx: E2EContext;
  let orderId: string;
  let payToken: string;
  let arriveCode: string;

  beforeAll(async () => {
    const app = await bootstrapApp();
    ctx = await createE2EContext(app);
  }, 60000);

  afterAll(async () => {
    if (ctx) {
      await cleanupE2EContext(ctx);
      await ctx.app.close();
    }
  }, 30000);

  // ---- 步骤 1: 客户下单 ----
  it('1. 客户下单 → pending_payment', async () => {
    const res = await request(ctx.server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({
        serviceItemId: ctx.serviceItemId,
        addressId: ctx.addressId,
        appointmentDate: '2026-09-01',
        appointmentSlot: '09:00-12:00',
        remark: 'E2E 测试订单',
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe(OrderStatus.PendingPayment);
    expect(res.body.id).toBeDefined();
    expect(res.body.orderNo).toBeDefined();
    orderId = res.body.id;
  });

  // ---- 步骤 2: 客户发起支付 ----
  it('2. 客户发起支付 → 获取 mock token', async () => {
    const res = await request(ctx.server)
      .post('/api/v1/payments/charge')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ orderId });
    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('mock');
    expect(res.body.payParams.token).toBeDefined();
    payToken = res.body.payParams.token;
  });

  // ---- 步骤 3: 模拟支付回调 ----
  it('3. 模拟支付成功 → pending_accept', async () => {
    const res = await request(ctx.server)
      .post('/api/v1/payments/mock/notify')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ orderId, token: payToken });
    expect(res.status).toBe(201);

    // 验证订单状态已变
    const order = await ctx.prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe(OrderStatus.PendingAccept);
  });

  // ---- 步骤 4: 师傅抢单 ----
  it('4. 师傅抢单 → accepted', async () => {
    const res = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/grab`)
      .set('Authorization', `Bearer ${ctx.masterToken}`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe(OrderStatus.Accepted);
    expect(res.body.masterId).toBe(ctx.masterId);
  });

  // ---- 步骤 5: 师傅出发 ----
  it('5. 师傅出发 → departing', async () => {
    const res = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/depart`)
      .set('Authorization', `Bearer ${ctx.masterToken}`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe(OrderStatus.Departing);
  });

  // ---- 步骤 6: 客户生成到达验证码 ----
  it('6. 客户生成到达验证码', async () => {
    const res = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/generate-arrive-code`)
      .set('Authorization', `Bearer ${ctx.customerToken}`);
    expect(res.status).toBe(201);
    expect(res.body.code).toBeDefined();
    expect(res.body.code).toHaveLength(6);
    arriveCode = res.body.code;
  });

  // ---- 步骤 7: 师傅确认到达 ----
  it('7. 师傅输入验证码到达 → arrived', async () => {
    const res = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/arrive`)
      .set('Authorization', `Bearer ${ctx.masterToken}`)
      .send({ code: arriveCode });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe(OrderStatus.Arrived);
  });

  // ---- 步骤 8: 师傅开始服务 ----
  it('8. 师傅开始服务 → servicing', async () => {
    const res = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${ctx.masterToken}`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe(OrderStatus.Servicing);
  });

  // ---- 步骤 9: 师傅完成服务 ----
  it('9. 师傅完成服务 → pending_confirm', async () => {
    const res = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${ctx.masterToken}`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe(OrderStatus.PendingConfirm);
  });

  // ---- 步骤 10: 客户验收 ----
  it('10. 客户验收 → reviewed', async () => {
    const res = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${ctx.customerToken}`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe(OrderStatus.Reviewed);
  });

  // ---- 步骤 11: 结算入账验证 ----
  it('11. 结算单自动生成 → type=normal, status=credited', async () => {
    const settlement = await ctx.prisma.settlement.findUnique({
      where: { orderId },
    });
    expect(settlement).not.toBeNull();
    expect(settlement!.type).toBe('normal');
    expect(settlement!.status).toBe('credited');
    expect(settlement!.masterId).toBe(ctx.masterId);
    // 佣金规则 platformRate=0.1 → platformFee = amount * 0.1, masterAmount = amount * 0.9
    const order = await ctx.prisma.order.findUnique({ where: { id: orderId } });
    const amount = Number(order!.amount);
    expect(Number(settlement!.orderAmount)).toBe(amount);
    expect(Number(settlement!.platformFee)).toBeCloseTo(amount * 0.1, 2);
    expect(Number(settlement!.masterAmount)).toBeCloseTo(amount * 0.9, 2);
  });
});
