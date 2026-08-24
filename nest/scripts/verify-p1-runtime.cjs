/* P1 运行时验证：投诉/退款端到端 + 状态机全流程（真实 3722 后端 + WS）
 * 链路1（P1-1）：造 reviewed 订单 → 客户投诉 → admin 处置(result=refund) → 创建退款申请 → admin 审核通过 → 阶梯退款入账（查 settlement 金额变化）
 * 链路2（P1-2）：造 pending_payment 订单 → 支付 → master 抢单 → depart/arrive/start/complete → 客户 confirm → 评价 → 终态 evaluated + WS 推送
 */
const fs = require('fs');
const { PrismaClient } = require('D:/FrontEnd/home_app/nest/node_modules/.prisma/client');
const jwt = require('C:/Users/yhnce/.workbuddy/binaries/node/workspace/node_modules/jsonwebtoken');
const io = require('C:/Users/yhnce/.workbuddy/binaries/node/workspace/node_modules/socket.io-client');
const BASE = 'http://127.0.0.1:3722/api';
const WS_URL = 'http://127.0.0.1:3722'; // 网关挂在 path='/ws'，连接时需显式传 path 选项

// ---- 载入 .env（strip 引号）----
const envTxt = fs.readFileSync('D:/FrontEnd/home_app/nest/.env', 'utf8');
const env = {};
envTxt.split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); env[m[1]] = v; }
});
Object.assign(process.env, env);
const SECRET = env.JWT_ACCESS_SECRET;
const prisma = new PrismaClient();

const log = (...a) => console.log(...a);
let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; log('  ✅ ' + msg); } else { fail++; log('  ❌ ' + msg); } }

function selfJwt(sub, role, extra = {}) { return jwt.sign({ sub, role, ...extra }, SECRET, { expiresIn: '2h' }); }

async function api(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`HTTP ${method} ${url} -> ${res.status}: ${text}`);
  return data;
}

async function ensureUser(phone, role, extra = {}) {
  const user = await prisma.user.upsert({
    where: { phone },
    update: { role },
    create: { phone, role, ...extra },
  });
  return user;
}
async function ensureMaster(phone, serviceAreas) {
  const user = await ensureUser(phone, 'master');
  let master = await prisma.master.findUnique({ where: { userId: user.id } });
  if (!master) master = await prisma.master.create({ data: { userId: user.id, realName: phone, serviceAreas: serviceAreas || [] } });
  else if (serviceAreas) master = await prisma.master.update({ where: { id: master.id }, data: { serviceAreas } });
  return { user, master };
}

const created = { users: [], masters: [], addrs: [], orders: [], tickets: [], refunds: [], settlements: [], si: null, cats: [] };
async function cleanup() {
  try {
    // 1) Order 的 Restrict 子表 → 按 orderId 先清（否则删 Order 报 FK 约束）
    if (created.orders.length) {
      await prisma.orderLog.deleteMany({ where: { orderId: { in: created.orders } } });
      await prisma.payment.deleteMany({ where: { orderId: { in: created.orders } } });
      await prisma.quotation.deleteMany({ where: { orderId: { in: created.orders } } }).catch(() => {});
      await prisma.review.deleteMany({ where: { orderId: { in: created.orders } } });
      await prisma.settlement.deleteMany({ where: { orderId: { in: created.orders } } });
    }
    // 2) Ticket（删除级联 Complaint + TicketComment）；Refund 由 Order 级联，或按 ticketId 显式清
    if (created.tickets.length) {
      await prisma.refund.deleteMany({ where: { ticketId: { in: created.tickets } } }).catch(() => {});
      await prisma.ticket.deleteMany({ where: { id: { in: created.tickets } } });
    }
    // 3) 最后删 Order（Restrict 子表已清；Ticket.orderId=SetNull；Refund 随 Order 级联）
    if (created.orders.length) await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    // 4) 服务项 / 类目（Order.serviceItemId 已无引用）
    if (created.si) await prisma.serviceItem.deleteMany({ where: { id: created.si } }).catch(() => {});
    if (created.cats.length) await prisma.serviceCategory.deleteMany({ where: { id: { in: created.cats } } }).catch(() => {});
    // 5) 地址 / 师傅 / 用户（admin 不入 created.users，保留）
    if (created.addrs.length) await prisma.address.deleteMany({ where: { id: { in: created.addrs } } });
    if (created.masters.length) await prisma.master.deleteMany({ where: { id: { in: created.masters } } });
    if (created.users.length) await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    log('[cleanup] 已完成');
  } catch (e) { log('[cleanup error]', e.message); throw e; }
}

async function main() {
  log('=== P1 运行时验证开始 ===');

  // ---- 准备账号 ----
  const admin = await ensureUser('admin', 'admin');
  const client = await ensureUser('P1client' + Date.now(), 'customer');
  const { user: masterUser, master } = await ensureMaster('P1master' + Date.now(), [{ provinceCode: '110000', cityCode: '110100', districtCode: '110105' }]);
  created.users.push(client.id, masterUser.id); // 保留真实 admin 账号，不删
  created.masters.push(master.id);
  const adminToken = selfJwt(admin.id, 'admin', { staffRoleKey: 'super_admin', perms: ['complaints:handle', 'tickets:manage'] });
  const clientToken = selfJwt(client.id, 'customer');
  const masterToken = selfJwt(masterUser.id, 'master');
  assert(!!adminToken && !!clientToken && !!masterToken, '三端账号登录拿到 token');
  if (!adminToken || !clientToken || !masterToken) { await cleanup(); return; }

  // ---- 公用：服务项 ----
  const cat = await prisma.serviceCategory.create({ data: { name: 'P1cat' } });
  created.cats.push(cat.id);
  const si = await prisma.serviceItem.create({ data: { categoryId: cat.id, name: 'P1测试清洗', price: 100, unit: '次' } });
  created.si = si.id;

  // ================= 链路1 P1-1 投诉/退款端到端 =================
  log('\n--- 链路1: 投诉 → 退款审核 → 入账 ---');
  const addr1 = await prisma.address.create({ data: { contactName: '客', contactPhone: '13800000001', province: '北京', city: '北京', district: '朝阳', provinceCode: '110000', cityCode: '110100', districtCode: '110105', detail: 'e2e-p1-1', userId: client.id } });
  created.addrs.push(addr1.id);
  const order1 = await prisma.order.create({
    data: {
      orderNo: 'P1A' + Date.now(), customerId: client.id, addressId: addr1.id, serviceItemId: si.id,
      serviceSnapshot: { name: 'P1测试清洗', price: 100, unit: '次' }, city: '北京', amount: 100,
      status: 'reviewed', masterId: master.id,
    },
  });
  created.orders.push(order1.id);
  const settle1 = await prisma.settlement.create({ data: { orderId: order1.id, masterId: master.id, masterAmount: 100, orderAmount: 100, status: 'credited', settledAt: new Date() } });
  created.settlements.push(settle1.id);

  // 客户投诉
  const t = await api('POST', '/tickets', { type: 'complaint', orderId: order1.id, reason: 'quality', title: '洗得不干净', content: '差评', expectation: 'refund' }, clientToken);
  created.tickets.push(t.id);
  assert(t && t.id, '客户提交投诉成功 ticket=' + (t && t.id));

  // admin 处置 result=refund（创建退款申请，关联到 refund 表 ticketId）
  await api('POST', `/tickets/${t.id}/complaint/resolve`, { result: 'refund', expectation: 'refund', note: '同意退款' }, adminToken);
  const rf = await prisma.refund.findFirst({ where: { ticketId: t.id } });
  assert(rf, 'admin 处置投诉(result=refund) 已创建退款申请');
  if (rf) created.refunds.push(rf.id);
  assert(rf && rf.status === 'pending_review', '退款单初始状态=pending_review（实际 ' + (rf && rf.status) + '）');

  // admin 审核通过
  await api('POST', `/payments/refunds/${rf.id}/approve`, { note: '通过' }, adminToken);
  const rf1 = await prisma.refund.findUnique({ where: { id: rf.id } });
  assert(rf1 && rf1.status === 'approved', '退款审核通过 → 状态=approved（实际 ' + (rf1 && rf1.status) + '）');

  // 验证入账：阶梯退款已执行（refundedAmount 记录）+ 结算单变化（信息性）
  const settle1b = await prisma.settlement.findUnique({ where: { id: settle1.id } });
  log('  结算单 masterAmount: 100 → ' + (settle1b && settle1b.masterAmount) + '；refund.refundedAmount=' + (rf1 && rf1.refundedAmount));
  assert(rf1 && Number(rf1.refundedAmount) > 0, '阶梯退款已执行入账（refundedAmount=' + (rf1 && rf1.refundedAmount) + '）');

  // ================= 链路2 P1-2 状态机全流程 + WS =================
  log('\n--- 链路2: 状态机 departing→arrived→evaluated + WS 推送 ---');
  const addr2 = await prisma.address.create({ data: { contactName: '客', contactPhone: '13800000002', province: '北京', city: '北京', district: '朝阳', provinceCode: '110000', cityCode: '110100', districtCode: '110105', detail: 'e2e-p1-2', userId: client.id } });
  created.addrs.push(addr2.id);
  const order2 = await prisma.order.create({
    data: {
      orderNo: 'P1B' + Date.now(), customerId: client.id, addressId: addr2.id, serviceItemId: si.id,
      serviceSnapshot: { name: 'P1测试清洗', price: 100, unit: '次' }, city: '北京', amount: 100,
      status: 'pending_payment',
    },
  });
  created.orders.push(order2.id);

  // WS：master 连池监听（网关挂在 path='/ws'，必须显式传 path 选项，否则 socket.io 默认打 /socket.io 路径 → connect_error）
  const wsMsgs = [];
  const sock = io(WS_URL, { path: '/ws', auth: { token: selfJwt(masterUser.id, 'master') }, transports: ['websocket'] });
  await new Promise((res) => {
    sock.on('connect', () => { sock.emit('join-pool'); res(); });
    sock.on('connect_error', (e) => { log('  WS connect_error:', e.message); });
    setTimeout(res, 3000);
  });
  sock.on('new-order', (o) => wsMsgs.push({ type: 'new-order', id: o.id }));
  sock.on('order-update', (o) => wsMsgs.push({ type: 'order-update', id: o.id, status: o.status }));
  await new Promise((r) => setTimeout(r, 800)); // 等 server 把连接异步 join 进 zone 房间

  // 支付
  const ch = await api('POST', '/payments/charge', { orderId: order2.id, method: 'mock' }, clientToken);
  log('  [debug] charge resp:', JSON.stringify(ch));
  const payToken = ch.payParams?.token || ch.token || (ch.data && ch.data.token);
  await api('POST', '/payments/mock/notify', { orderId: order2.id, token: payToken }, clientToken);
  const oPay = await prisma.order.findUnique({ where: { id: order2.id } });
  assert(oPay.status === 'pending_accept', '支付成功 → 状态=pending_accept（实际 ' + oPay.status + '）');

  // master 抢单 → 出发 → 客户生成到达码 → 师傅到达 → 开始 → 完成 → 客户验收 → 评价
  await api('POST', `/orders/${order2.id}/grab`, {}, masterToken);
  await api('POST', `/orders/${order2.id}/depart`, {}, masterToken);
  const codeRes = await api('POST', `/orders/${order2.id}/generate-arrive-code`, {}, clientToken);
  const code = codeRes.code;
  await api('POST', `/orders/${order2.id}/arrive`, { code }, masterToken);
  await api('POST', `/orders/${order2.id}/start`, {}, masterToken);
  await api('POST', `/orders/${order2.id}/complete`, {}, masterToken);
  await api('POST', `/orders/${order2.id}/confirm`, {}, clientToken);
  await api('POST', '/reviews', { orderId: order2.id, rating: 5 }, clientToken);
  const oFin = await prisma.order.findUnique({ where: { id: order2.id } });
  assert(oFin.status === 'evaluated', '状态机全程推进 → 终态=evaluated（实际 ' + oFin.status + '）');

  // WS 断言
  await new Promise((r) => setTimeout(r, 500));
  const gotNew = wsMsgs.some((m) => m.type === 'new-order' && m.id === order2.id);
  const gotUpd = wsMsgs.some((m) => m.type === 'order-update' && m.id === order2.id);
  assert(gotNew, 'WS 收到 new-order 推送');
  assert(gotUpd, 'WS 收到 order-update 推送');
  sock.disconnect();

  await cleanup();

  log(`\n=== P1 验证结果: PASS=${pass} FAIL=${fail} ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { log('FATAL', e.stack || e.message); await cleanup().catch(() => {}); process.exit(1); });
