/**
 * P2-3 WS 新单区域过滤 —— 端到端集成验证
 *
 * 真实链路（不走 mock 短路）：
 *   1. 用 Prisma 直连准备数据：customer + 两个区域 master（北京/上海，各自 serviceAreas）+ 一个 serviceItem + 两个地址（北京/上海）
 *   2. 自己签 JWT（与网关同一套 JWT_ACCESS_SECRET），模拟两个 master 连真实 3722 后端 WS 并 emit join-pool
 *   3. 通过真实 HTTP 触发两笔订单的支付成功（POST /payments/charge → /payments/mock/notify），走 applyPaid → broadcastNewOrder(含 address)
 *   4. 断言：北京单仅北京 master 收到 new-order；上海单仅上海 master 收到 new-order
 *
 * 运行前：先在 3722 起临时后端（PORT=3722 nest start），脚本连它。
 * 依赖：@prisma/client（nest/node_modules）、socket.io-client + jsonwebtoken（managed workspace）
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// 直连已生成的 Prisma client（pnpm 下 require('@prisma/client') 经 symlink 会解析到虚拟 store 旧副本，
// 故用项目根已 regenerate 的新 client 绝对路径，确保脚本侧造数据用最新 schema 字段）。
const { PrismaClient } = require('D:/FrontEnd/home_app/nest/node_modules/.prisma/client');
const WS_URL = 'http://127.0.0.1:3722';
const API = WS_URL + '/api';
const WS_LIB = 'C:/Users/yhnce/.workbuddy/binaries/node/workspace/node_modules/socket.io-client';
const JWT_LIB = 'C:/Users/yhnce/.workbuddy/binaries/node/workspace/node_modules/jsonwebtoken';
const { io } = require(WS_LIB);
const jwt = require(JWT_LIB);

// 把 .env 载入 process.env（PrismaClient 实例化时读 DATABASE_URL / JWT secret）
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
// 读 JWT secret（与网关 JwtService 同源）
function loadSecret() {
  const envPath = path.resolve(__dirname, '..', '.env');
  const txt = fs.readFileSync(envPath, 'utf8');
  const m = txt.match(/JWT_ACCESS_SECRET\s*=\s*(.+)/);
  if (!m) throw new Error('JWT_ACCESS_SECRET not found in .env');
  return m[1].trim();
}
loadEnv();
const SECRET = process.env.JWT_ACCESS_SECRET || loadSecret();
const prisma = new PrismaClient();

function sign(role, sub) {
  return jwt.sign({ sub, role, jti: crypto.randomUUID() }, SECRET, { expiresIn: 3600 });
}

async function ensureUser(phone, role) {
  return prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone, role, profile: { create: { nickname: `e2e-${phone}` } } },
  });
}
async function ensureMaster(user, areas) {
  await prisma.master.upsert({
    where: { userId: user.id },
    update: { serviceAreas: areas, status: 'active' },
    create: {
      userId: user.id,
      realName: `e2e-${user.phone}`,
      city: 'e2e',
      status: 'active',
      serviceAreas: areas,
    },
  });
}
async function ensureServiceItem() {
  let item = await prisma.serviceItem.findFirst({ where: { isActive: true } });
  if (!item) {
    const cat =
      (await prisma.serviceCategory.findFirst()) ||
      (await prisma.serviceCategory.create({ data: { name: 'e2e-cat' } }));
    item = await prisma.serviceItem.create({
      data: { categoryId: cat.id, name: 'e2e-item', price: 100 },
    });
  }
  return item;
}
async function makeAddress(customer, codes, names) {
  return prisma.address.create({
    data: {
      userId: customer.id,
      contactName: 'e2e',
      contactPhone: customer.phone,
      province: names.province,
      provinceCode: codes.p,
      city: names.city,
      cityCode: codes.c,
      district: names.district,
      districtCode: codes.d,
      detail: 'e2e-detail',
    },
  });
}
async function makeOrder(customer, item, address) {
  return prisma.order.create({
    data: {
      orderNo: `E2E${Date.now()}${Math.floor(Math.random() * 1000)}`,
      customerId: customer.id,
      addressId: address.id,
      serviceItemId: item.id,
      serviceSnapshot: { name: item.name, price: 100 },
      city: address.city,
      amount: 100,
      status: 'pending_payment',
    },
  });
}
async function payOrder(orderId, token) {
  const r1 = await fetch(API + '/payments/charge', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  const j1 = await r1.json();
  if (!j1?.payParams?.token) throw new Error('charge 失败: ' + JSON.stringify(j1));
  const r2 = await fetch(API + '/payments/mock/notify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ orderId, token: j1.payParams.token }),
  });
  return r2.status;
}

function listenMaster(token) {
  return new Promise((resolve) => {
    const sock = io(WS_URL, { path: '/ws', auth: { token }, transports: ['websocket'] });
    const got = [];
    sock.on('connect', () => sock.emit('join-pool'));
    sock.on('new-order', (o) => got.push(o?.id));
    sock.on('connect_error', (e) => console.log('  [warn] connect_error:', e.message));
    resolve({ sock, got });
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const results = [];
  let masterA, masterB, customer, item, addrBJ, addrSH, orderBJ, orderSH;
  const sockets = [];
  try {
    // ---- 1. 准备数据 ----
    console.log('[1] 准备数据（Prisma 直连）...');
    customer = await ensureUser('13800000001', 'customer');
    const mAU = await ensureUser('13800000002', 'master');
    const mBU = await ensureUser('13800000003', 'master');
    await ensureMaster(mAU, [{ provinceCode: '110000', cityCode: '110100', districtCode: '110105' }]);
    await ensureMaster(mBU, [{ provinceCode: '310000', cityCode: '310100', districtCode: '310115' }]);
    masterA = mAU;
    masterB = mBU;
    item = await ensureServiceItem();
    addrBJ = await makeAddress(customer, { p: '110000', c: '110100', d: '110105' }, {
      province: '北京市', city: '北京市', district: '朝阳区',
    });
    addrSH = await makeAddress(customer, { p: '310000', c: '310100', d: '310115' }, {
      province: '上海市', city: '上海市', district: '浦东新区',
    });
    orderBJ = await makeOrder(customer, item, addrBJ);
    orderSH = await makeOrder(customer, item, addrSH);
    console.log(`    customer=${customer.id} masterA(BJ)=${masterA.id} masterB(SH)=${masterB.id}`);
    console.log(`    orderBJ=${orderBJ.id}(北京) orderSH=${orderSH.id}(上海) item=${item.id}`);

    // ---- 2. 两个 master 连 WS + join-pool ----
    console.log('[2] 两个区域 master 连 WS 并 join-pool...');
    const tokA = sign('master', masterA.id);
    const tokB = sign('master', masterB.id);
    const custTok = sign('customer', customer.id);
    const a = await listenMaster(tokA);
    const b = await listenMaster(tokB);
    sockets.push(a.sock, b.sock);
    await wait(1000); // 等 server 异步把连接 join 进 zone 房间

    // ---- 3. 触发北京单支付成功 ----
    console.log('[3] 触发北京单支付成功（真实 /payments/mock/notify）...');
    const s1 = await payOrder(orderBJ.id, custTok);
    console.log(`    pay status=${s1}`);
    await wait(2500);

    // ---- 4. 触发上海单支付成功 ----
    console.log('[4] 触发上海单支付成功...');
    const s2 = await payOrder(orderSH.id, custTok);
    console.log(`    pay status=${s2}`);
    await wait(2500);

    // ---- 5. 断言 ----
    console.log('[5] 断言区域过滤...');
    const aBJ = a.got.includes(orderBJ.id);
    const bBJ = b.got.includes(orderBJ.id);
    const aSH = a.got.includes(orderSH.id);
    const bSH = b.got.includes(orderSH.id);
    console.log(`    masterA(北京) 收北京单=${aBJ} 收上海单=${aSH}  → got=[${a.got.join(',')}]`);
    console.log(`    masterB(上海) 收北京单=${bBJ} 收上海单=${bSH}  → got=[${b.got.join(',')}]`);

    const checks = [
      { name: '北京 master 收到北京单', pass: aBJ },
      { name: '上海 master 未收到北京单', pass: !bBJ },
      { name: '上海 master 收到上海单', pass: bSH },
      { name: '北京 master 未收到上海单', pass: !aSH },
    ];
    let allPass = true;
    for (const c of checks) {
      console.log(`    [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`);
      if (!c.pass) allPass = false;
    }
    results.push({ allPass, aGot: a.got, bGot: b.got });

    if (!allPass) process.exitCode = 1;
  } catch (e) {
    console.error('[ERROR]', e);
    process.exitCode = 2;
  } finally {
    sockets.forEach((s) => s && s.disconnect());
    // 清理测试产生的订单/支付/日志/地址（含历史 e2e 残留），保留 user/master 复用
    try {
      const e2eOrders = await prisma.order.findMany({
        where: { orderNo: { startsWith: 'E2E' } },
        select: { id: true },
      });
      const e2eIds = e2eOrders.map((o) => o.id);
      if (e2eIds.length) {
        await prisma.orderLog.deleteMany({ where: { orderId: { in: e2eIds } } });
        await prisma.payment.deleteMany({ where: { orderId: { in: e2eIds } } });
        await prisma.order.deleteMany({ where: { id: { in: e2eIds } } });
      }
      await prisma.address.deleteMany({ where: { detail: 'e2e-detail' } }).catch(() => {});
      console.log(`[cleanup] 已删除 ${e2eIds.length} 笔 e2e 订单及其支付/日志/地址`);
    } catch (e2) {
      console.error('[cleanup error]', e2.message);
    }
    await prisma.$disconnect();
    console.log(allPassFinal(results) ? '\n=== E2E RESULT: ALL PASS ===' : '\n=== E2E RESULT: FAIL ===');
  }
})();

function allPassFinal(r) {
  return r.length > 0 && r[0].allPass;
}
