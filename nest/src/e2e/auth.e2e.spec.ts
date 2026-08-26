import request from 'supertest';
import {
  bootstrapApp,
  createE2EContext,
  cleanupE2EContext,
  E2EContext,
} from './setup';

describe('认证流程 e2e — 登录 / 错误密码 / 刷新 token', () => {
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

  it('1. 客户密码登录成功，返回 accessToken + refreshToken', async () => {
    const res = await request(ctx.server)
      .post('/api/v1/auth/login')
      .send({ phone: ctx.testPhones[0], password: 'Test1234!', mode: 'password' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.role).toBe('customer');
  });

  it('2. 师傅密码登录成功，role=master', async () => {
    const res = await request(ctx.server)
      .post('/api/v1/auth/login')
      .send({ phone: ctx.testPhones[1], password: 'Test1234!', mode: 'password' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('master');
  });

  it('3. 管理员登录（mode=admin）成功，role=admin', async () => {
    const res = await request(ctx.server)
      .post('/api/v1/auth/login')
      .send({ phone: ctx.testPhones[2], password: 'Test1234!', mode: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('admin');
  });

  it('4. 错误密码登录失败，返回 401', async () => {
    const res = await request(ctx.server)
      .post('/api/v1/auth/login')
      .send({ phone: ctx.testPhones[0], password: 'WrongPass1!', mode: 'password' });
    expect(res.status).toBe(401);
  });

  it('5. 不存在的手机号登录失败，返回 401', async () => {
    const res = await request(ctx.server)
      .post('/api/v1/auth/login')
      .send({ phone: '13900000000', password: 'Test1234!', mode: 'password' });
    expect(res.status).toBe(401);
  });

  it('6. refresh token 换取新 accessToken', async () => {
    const loginRes = await request(ctx.server)
      .post('/api/v1/auth/login')
      .send({ phone: ctx.testPhones[0], password: 'Test1234!', mode: 'password' });
    const refreshToken = loginRes.body.refreshToken;

    const res = await request(ctx.server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
  });

  it('7. 无效 refresh token 失败，返回 401', async () => {
    const res = await request(ctx.server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'invalid-token-string' });
    expect(res.status).toBe(401);
  });

  it('8. 未携带 token 访问受保护接口，返回 401', async () => {
    const res = await request(ctx.server).get('/api/v1/orders/mine');
    expect(res.status).toBe(401);
  });
});
