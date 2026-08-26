// 生产级幂等管理员初始化（替代硬编码路径的 fix-admin.cjs）。
// 从环境变量读取账号/密码，首次创建或更新密码，并绑定 super_admin 岗位角色。
//
// 用法（需先 prisma generate + DATABASE_URL 在环境变量中）：
//   ADMIN_PHONE=admin ADMIN_PASSWORD=强密码 DATABASE_URL=mysql://... node nest/scripts/init-admin.cjs
//
// 也可被 InstallService 调用：const { initAdmin } = require('./scripts/init-admin.cjs'); initAdmin(prisma, phone, password);
//
// 幂等：
//   - super_admin 角色不存在 → 报错（请先执行 seed）
//   - 该 phone 用户不存在 → 创建（role=admin，建 UserProfile，绑定 super_admin）
//   - 该 phone 用户已存在 → 更新 passwordHash，role 置 admin，未绑角色则绑定 super_admin
//   - 可重复执行
const { PrismaClient } = require('../node_modules/.prisma/client');
const bcrypt = require('bcryptjs');

async function initAdmin(prisma, phone, password, nickname) {
  const SUPER = 'super_admin';
  const sr = await prisma.staffRole.findUnique({ where: { key: SUPER } });
  if (!sr) throw new Error('super_admin 角色不存在，请先执行 nest/prisma/seed.js');

  const passwordHash = bcrypt.hashSync(password, 10);
  const existing = await prisma.user.findUnique({ where: { phone } });

  if (!existing) {
    const u = await prisma.user.create({
      data: {
        phone,
        passwordHash,
        role: 'admin',
        profile: { create: { nickname: nickname || '超级管理员' } },
        staffRole: { connect: { id: sr.id } },
      },
    });
    console.log(`[init-admin] 已创建管理员 id=${u.id} phone=${phone}`);
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        role: 'admin',
        ...(existing.staffRoleId ? {} : { staffRole: { connect: { id: sr.id } } }),
      },
    });
    console.log(`[init-admin] 已更新管理员密码 id=${existing.id} phone=${phone}`);
  }
}

module.exports = { initAdmin };

if (require.main === module) {
  const phone = process.env.ADMIN_PHONE || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  const nickname = process.env.ADMIN_NICKNAME || '超级管理员';

  function die(msg) {
    console.error('[init-admin] ' + msg);
    process.exit(1);
  }

  if (!password) die('缺少环境变量 ADMIN_PASSWORD');
  if (!process.env.DATABASE_URL) die('缺少环境变量 DATABASE_URL');

  const prisma = new PrismaClient();
  initAdmin(prisma, phone, password, nickname)
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error('[init-admin] 失败:', e.message);
      prisma.$disconnect();
      process.exit(1);
    });
}
