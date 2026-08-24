import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { OrderStatus } from '@laoma/shared';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

export interface E2EContext {
  app: INestApplication;
  prisma: PrismaService;
  server: ReturnType<INestApplication['getHttpServer']>;
  customerToken: string;
  masterToken: string;
  adminToken: string;
  customerUserId: string;
  masterUserId: string;
  adminUserId: string;
  masterId: string;
  addressId: string;
  serviceItemId: string;
  testPhones: string[];
}

const PASSWORD = 'Test1234!';
const PROVINCE_CODE = '11';
const CITY_CODE = '1101';
const DISTRICT_CODE = '110101';

export async function bootstrapApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

export async function createE2EContext(app: INestApplication): Promise<E2EContext> {
  const prisma = app.get(PrismaService);
  const server = app.getHttpServer();

  const ts = Date.now().toString().slice(-8);
  const customerPhone = `130${ts}`;
  const masterPhone = `131${ts}`;
  const adminPhone = `132${ts}`;
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  // --- Admin ---
  const superAdminRole = await prisma.staffRole.findUnique({ where: { key: 'super_admin' } });
  const admin = await prisma.user.create({
    data: {
      phone: adminPhone,
      role: 'admin',
      status: 'active',
      passwordHash,
      staffRoleId: superAdminRole?.id,
    },
  });

  // --- Customer ---
  const customer = await prisma.user.create({
    data: {
      phone: customerPhone,
      role: 'customer',
      status: 'active',
      passwordHash,
    },
  });
  await prisma.userProfile.create({
    data: {
      userId: customer.id,
      nickname: 'E2E客户',
      provinceCode: PROVINCE_CODE,
      cityCode: CITY_CODE,
    },
  });

  // --- Master ---
  const masterUser = await prisma.user.create({
    data: {
      phone: masterPhone,
      role: 'master',
      status: 'active',
      passwordHash,
    },
  });
  const master = await prisma.master.create({
    data: {
      userId: masterUser.id,
      realName: 'E2E师傅',
      status: 'active',
      provinceCode: PROVINCE_CODE,
      cityCode: CITY_CODE,
      serviceAreas: [{ provinceCode: PROVINCE_CODE, cityCode: null, districtCode: null }],
      skills: [],
      idVerified: true,
    },
  });

  // --- Address ---
  const address = await prisma.address.create({
    data: {
      userId: customer.id,
      contactName: 'E2E客户',
      contactPhone: customerPhone,
      province: '北京市',
      provinceCode: PROVINCE_CODE,
      city: '北京市',
      cityCode: CITY_CODE,
      district: '东城区',
      districtCode: DISTRICT_CODE,
      detail: '测试地址123号',
    },
  });

  // --- ServiceArea（平台开通区域）---
  const existingArea = await prisma.serviceArea.findUnique({ where: { code: '110000' } });
  if (existingArea) {
    if (!existingArea.isActive) {
      await prisma.serviceArea.update({
        where: { code: '110000' },
        data: { isActive: true },
      });
    }
  } else {
    await prisma.serviceArea.create({
      data: {
        level: 1,
        name: '北京市',
        code: '110000',
        province: '北京市',
        provinceCode: PROVINCE_CODE,
        isActive: true,
      },
    });
  }

  // --- CommissionRule（全局佣金规则）---
  const existingRule = await prisma.commissionRule.findFirst({ where: { scope: 'global' } });
  if (existingRule) {
    await prisma.commissionRule.update({
      where: { id: existingRule.id },
      data: {
        platformRate: 0.1,
        refundPolicy: 'tiered',
        refundTiers: { departing: 0.8, arrived: 0.5 },
        isActive: true,
      },
    });
  } else {
    await prisma.commissionRule.create({
      data: {
        scope: 'global',
        refId: '',
        platformRate: 0.1,
        refundPolicy: 'tiered',
        refundTiers: { departing: 0.8, arrived: 0.5 },
        isActive: true,
      },
    });
  }

  // --- 找一个激活的服务项 ---
  const serviceItem = await prisma.serviceItem.findFirst({
    where: { isActive: true },
  });
  if (!serviceItem) throw new Error('种子数据缺少 ServiceItem，请先运行 seed:items');

  // --- 登录获取 token ---
  const customerLogin = await request(server)
    .post('/api/auth/login')
    .send({ phone: customerPhone, password: PASSWORD, mode: 'password' });
  const masterLogin = await request(server)
    .post('/api/auth/login')
    .send({ phone: masterPhone, password: PASSWORD, mode: 'password' });
  const adminLogin = await request(server)
    .post('/api/auth/login')
    .send({ phone: adminPhone, password: PASSWORD, mode: 'admin' });

  if (!customerLogin.body.accessToken) {
    throw new Error(`客户登录失败: ${JSON.stringify(customerLogin.body)}`);
  }

  return {
    app,
    prisma,
    server,
    customerToken: customerLogin.body.accessToken,
    masterToken: masterLogin.body.accessToken,
    adminToken: adminLogin.body.accessToken,
    customerUserId: customer.id,
    masterUserId: masterUser.id,
    adminUserId: admin.id,
    masterId: master.id,
    addressId: address.id,
    serviceItemId: serviceItem.id,
    testPhones: [customerPhone, masterPhone, adminPhone],
  };
}

export async function cleanupE2EContext(ctx: E2EContext) {
  const { prisma, testPhones } = ctx;
  const allUsers = await prisma.user.findMany({ where: { phone: { in: testPhones } }, select: { id: true } });
  const userIds = allUsers.map((u: any) => u.id);

  // 按外键依赖逆序清理
  await prisma.settlement.deleteMany({ where: { masterId: ctx.masterId } }).catch(() => {});
  await prisma.payment.deleteMany({ where: { customerId: ctx.customerUserId } }).catch(() => {});
  await prisma.orderLog.deleteMany({ where: { order: { customerId: ctx.customerUserId } } }).catch(() => {});
  await prisma.ticket.deleteMany({ where: { customerId: ctx.customerUserId } }).catch(() => {});
  await prisma.refund.deleteMany({ where: { requestedById: { in: userIds } } }).catch(() => {});
  await prisma.order.deleteMany({ where: { customerId: ctx.customerUserId } }).catch(() => {});
  await prisma.address.deleteMany({ where: { userId: ctx.customerUserId } }).catch(() => {});
  await prisma.master.deleteMany({ where: { userId: ctx.masterUserId } }).catch(() => {});
  await prisma.userProfile.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { phone: { in: testPhones } } }).catch(() => {});
  await prisma.serviceArea.deleteMany({ where: { code: '110000' } }).catch(() => {});
}

/** 走完正向全链（下单→支付→抢单→出发→到达→开始→完成→验收），返回 reviewed 订单 ID */
export async function createAndCompleteOrder(ctx: E2EContext): Promise<string> {
  const { server, customerToken, masterToken, addressId, serviceItemId } = ctx;

  // 1. 下单
  const createRes = await request(server)
    .post('/api/orders')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ serviceItemId, addressId, appointmentDate: '2026-09-01', appointmentSlot: '09:00-12:00' });
  const orderId = createRes.body.id;

  // 2. 支付
  const chargeRes = await request(server)
    .post('/api/payments/charge')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ orderId });
  const token = chargeRes.body.payParams.token;

  // 3. 模拟支付回调
  await request(server)
    .post('/api/payments/mock/notify')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ orderId, token });

  // 4. 抢单
  await request(server)
    .post(`/api/orders/${orderId}/grab`)
    .set('Authorization', `Bearer ${masterToken}`);

  // 5. 出发
  await request(server)
    .post(`/api/orders/${orderId}/depart`)
    .set('Authorization', `Bearer ${masterToken}`);

  // 6. 生成到达码
  const codeRes = await request(server)
    .post(`/api/orders/${orderId}/generate-arrive-code`)
    .set('Authorization', `Bearer ${customerToken}`);

  // 7. 到达
  await request(server)
    .post(`/api/orders/${orderId}/arrive`)
    .set('Authorization', `Bearer ${masterToken}`)
    .send({ code: codeRes.body.code });

  // 8. 开始服务
  await request(server)
    .post(`/api/orders/${orderId}/start`)
    .set('Authorization', `Bearer ${masterToken}`);

  // 9. 完成服务
  await request(server)
    .post(`/api/orders/${orderId}/complete`)
    .set('Authorization', `Bearer ${masterToken}`);

  // 10. 验收
  await request(server)
    .post(`/api/orders/${orderId}/confirm`)
    .set('Authorization', `Bearer ${customerToken}`);

  return orderId;
}
