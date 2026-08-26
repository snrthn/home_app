/**
 * 权限码种子（prisma/seed.js）。
 * 作用：把 RBAC 需要的 Permission 行写入库，并把工单/投诉相关权限绑定到 cs_agent / ops_lead 角色。
 *
 * 为什么是 .js 而不是 .ts：本仓库未安装 ts-node/tsx，且 @prisma/client 的 re-export 在此环境被改写，
 * 故直接 require 生成后的客户端（与 nest/src/prisma/prisma.service.ts 同一路径），用 node 直接跑：
 *   node prisma/seed.js
 * 或：pnpm seed
 *
 * 幂等：permission 用 code upsert；角色权限每次重建绑定，可重复执行。
 */
const { PrismaClient } = require('../node_modules/.prisma/client');

// 导出供 InstallService 调用；独立运行时自动创建 prisma 实例
async function seedPermissions(prisma) {

// 资源 -> 权限分组（管理页展示用，与 admin-menu.ts 侧边栏分组名对齐）
const GROUP = {
  users: '用户管理',
  services: '服务与类目',
  dispatch: '调度派单',
  orders: '订单管理',
  finance: '财务结算',
  reviews: '评价客服',
  complaints: '评价客服',
  tickets: '评价客服',
  content: '内容管理',
  reports: '数据报表',
  settings: '系统设置',
  logs: '系统设置',
};

// 动作 -> 中文名片段（与 admin-menu.ts 菜单项文案对齐）
const ACTION = {
  read: '查看',
  manage: '管理',
  toggle: '启停',
  verify: '审核',
  edit: '编辑',
  refund: '退款/售后',
  moderate: '评价处置',
  handle: '投诉处理',
  smart: '智能派单',
  pool: '抢单池',
  category_manage: '服务类目',
  item_manage: '服务项目',
  area_manage: '服务区域',
  role_manage: '角色与系统管理',
  view: '查看',
  admin_read: '后台账号查看',
  admin_manage: '后台账号管理',
  customer_read: '客户管理查看',
  customer_toggle: '客户启停',
  master_read: '师傅管理查看',
  master_toggle: '师傅启停',
  master_verify: '师傅认证审核',
};

const CODES = [
  'users:admin_read', 'users:admin_manage', 'users:customer_read', 'users:customer_toggle',
  'users:master_read', 'users:master_toggle', 'users:master_verify', 'users:verify',
  'services:category_manage', 'services:item_manage', 'services:area_manage',
  'dispatch:smart', 'orders:read', 'orders:edit', 'orders:refund',
  'finance:manage', 'reviews:read', 'reviews:moderate',
  'complaints:handle', 'tickets:manage', 'content:manage', 'reports:view',
  'settings:role_manage', 'logs:view',
];

function meta(code) {
  const [resource, action] = code.split(':');
  const group = GROUP[resource] || resource;
  const actionName = ACTION[action] || action;
  return { code, name: `${group}·${actionName}`, resource, action, group };
}

const ROLES = {
  super_admin: { name: '超级管理员', perms: '*', system: true },
  ops_lead: {
    name: '运营主管',
    perms: ['complaints:handle', 'tickets:manage', 'reviews:read', 'orders:read', 'orders:refund', 'finance:manage', 'dispatch:smart'],
  },
  cs_agent: {
    name: '客服',
    perms: ['complaints:handle', 'tickets:manage', 'reviews:read', 'orders:read'],
  },
};

  // 1) upsert 全部权限码
  const permIds = {};
  for (const code of CODES) {
    const m = meta(code);
    const p = await prisma.permission.upsert({
      where: { code },
      update: { name: m.name, resource: m.resource, action: m.action, group: m.group },
      create: m,
    });
    permIds[code] = p.id;
  }
  console.log(`权限码就绪：${CODES.length} 条`);

  // 2) 角色 + 权限绑定
  for (const [key, cfg] of Object.entries(ROLES)) {
    const existing = await prisma.staffRole.findUnique({ where: { key } });
    let role;
    if (existing) {
      role = existing;
      // super_admin 已存在则保留其原有权限，避免覆盖历史配置
      if (key === 'super_admin') {
        console.log(`角色 ${key} 已存在，保留原权限`);
        continue;
      }
    } else {
      role = await prisma.staffRole.create({ data: { key, name: cfg.name, isSystem: !!cfg.system } });
      console.log(`角色 ${key} 已创建`);
    }
    const codes = cfg.perms === '*' ? CODES : cfg.perms;
    const links = codes
      .map((c) => ({ roleId: role.id, permissionId: permIds[c] }))
      .filter((l) => l.permissionId);
    await prisma.$transaction([
      prisma.staffRolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.staffRolePermission.createMany({ data: links }),
    ]);
    console.log(`角色 ${key} 已绑定 ${links.length} 个权限`);
  }
  console.log('SEED DONE');
}

module.exports = { seedPermissions };

if (require.main === module) {
  const prisma = new PrismaClient();
  seedPermissions(prisma)
    .then(() => prisma.systemConfig.upsert({
      where: { id: 1 },
      update: { installed: true, installedAt: new Date() },
      create: { id: 1, siteName: '老马家电', smsMode: 'mock', installed: true, installedAt: new Date() },
    }))
    .then(() => { console.log('installed=true (standalone seed)'); return prisma.$disconnect(); })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
