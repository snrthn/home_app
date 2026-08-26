import request from 'supertest';
import { OrderStatus } from '@laoma/shared';
import {
  bootstrapApp,
  createE2EContext,
  cleanupE2EContext,
  E2EContext,
} from './setup';

describe('订单取消 e2e — 待支付取消 / 已支付取消', () => {
  let ctx: E2EContext;

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

  it('1. 客户下单后取消（待支付状态）→ cancelled', async () => {
    const createRes = await request(ctx.server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({
        serviceItemId: ctx.serviceItemId,
        addressId: ctx.addressId,
        appointmentDate: '2026-09-01',
        appointmentSlot: '09:00-12:00',
      });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.id;

    const cancelRes = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ reason: '不需要了' });
    expect(cancelRes.status).toBe(201);
    expect(cancelRes.body.status).toBe(OrderStatus.Cancelled);
    expect(cancelRes.body.cancelReason).toBe('不需要了');
  });

  it('2. 已支付订单取消 → cancelled（需退款）', async () => {
    const createRes = await request(ctx.server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({
        serviceItemId: ctx.serviceItemId,
        addressId: ctx.addressId,
        appointmentDate: '2026-09-01',
        appointmentSlot: '09:00-12:00',
      });
    const orderId = createRes.body.id;

    const chargeRes = await request(ctx.server)
      .post('/api/v1/payments/charge')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ orderId });
    const token = chargeRes.body.payParams.token;

    await request(ctx.server)
      .post('/api/v1/payments/mock/notify')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ orderId, token });

    const cancelRes = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ reason: '服务质量不满足预期' });
    expect(cancelRes.status).toBe(201);
    expect(cancelRes.body.status).toBe(OrderStatus.Cancelled);
  });

  it('3. 已接单订单客户取消 → cancelled', async () => {
    const createRes = await request(ctx.server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({
        serviceItemId: ctx.serviceItemId,
        addressId: ctx.addressId,
        appointmentDate: '2026-09-01',
        appointmentSlot: '09:00-12:00',
      });
    const orderId = createRes.body.id;

    const chargeRes = await request(ctx.server)
      .post('/api/v1/payments/charge')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ orderId });
    await request(ctx.server)
      .post('/api/v1/payments/mock/notify')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ orderId, token: chargeRes.body.payParams.token });

    await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/grab`)
      .set('Authorization', `Bearer ${ctx.masterToken}`);

    const cancelRes = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ reason: '师傅联系不上' });
    expect(cancelRes.status).toBe(201);
    expect(cancelRes.body.status).toBe(OrderStatus.Cancelled);
  });

  it('4. 取消订单时缺理由 → 400', async () => {
    const createRes = await request(ctx.server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({
        serviceItemId: ctx.serviceItemId,
        addressId: ctx.addressId,
        appointmentDate: '2026-09-01',
        appointmentSlot: '09:00-12:00',
      });
    const orderId = createRes.body.id;

    const cancelRes = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({});
    expect(cancelRes.status).toBe(400);
  });

  it('5. 已完成订单不可取消 → 400', async () => {
    const createRes = await request(ctx.server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({
        serviceItemId: ctx.serviceItemId,
        addressId: ctx.addressId,
        appointmentDate: '2026-09-01',
        appointmentSlot: '09:00-12:00',
      });
    const orderId = createRes.body.id;

    const chargeRes = await request(ctx.server)
      .post('/api/v1/payments/charge')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ orderId });
    await request(ctx.server)
      .post('/api/v1/payments/mock/notify')
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ orderId, token: chargeRes.body.payParams.token });

    await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/grab`)
      .set('Authorization', `Bearer ${ctx.masterToken}`);
    await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/depart`)
      .set('Authorization', `Bearer ${ctx.masterToken}`);
    const codeRes = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/generate-arrive-code`)
      .set('Authorization', `Bearer ${ctx.customerToken}`);
    await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/arrive`)
      .set('Authorization', `Bearer ${ctx.masterToken}`)
      .send({ code: codeRes.body.code });
    await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${ctx.masterToken}`);
    await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${ctx.masterToken}`);
    await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${ctx.customerToken}`);

    const cancelRes = await request(ctx.server)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${ctx.customerToken}`)
      .send({ reason: '事后反悔' });
    expect(cancelRes.status).toBe(400);
  });
});
