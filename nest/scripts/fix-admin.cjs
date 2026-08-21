// 修复 admin 登录：给 phone='admin' 用户补 passwordHash + 绑定 super_admin staffRole
// 仅改此一个用户，不影响其他 admin。
const fs = require('fs');
const envPath = 'D:/FrontEnd/home_app/nest/.env';
const envRaw = fs.readFileSync(envPath, 'utf8');
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
  if (m) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, '');
}
const { PrismaClient } = require('D:/FrontEnd/home_app/nest/node_modules/.prisma/client');
const bcrypt = require('D:/FrontEnd/home_app/nest/node_modules/bcryptjs');
const prisma = new PrismaClient();

(async () => {
  const SUPER = 'super_admin';
  const phone = 'admin';
  const password = 'admin123';

  const sr = await prisma.staffRole.findUnique({ where: { key: SUPER } });
  console.log('SUPER_ADMIN_STAFFROLE:', sr ? sr.id : 'NOT_FOUND');

  let user = await prisma.user.findUnique({ where: { phone } });
  const passwordHash = bcrypt.hashSync(password, 10);

  if (!user) {
    console.log('ADMIN_NOT_EXIST, creating...');
    user = await prisma.user.create({
      data: {
        phone,
        passwordHash,
        role: 'admin',
        profile: { create: { nickname: '超级管理员' } },
        ...(sr ? { staffRole: { connect: { id: sr.id } } } : {}),
      },
    });
    console.log('CREATED', user.id);
  } else {
    console.log('ADMIN_EXISTS', user.id, 'hasPassword(before)=', !!user.passwordHash, 'staffRoleId(before)=', user.staffRoleId);
    const data = { passwordHash };
    if (sr && !user.staffRoleId) data.staffRole = { connect: { id: sr.id } };
    user = await prisma.user.update({ where: { id: user.id }, data });
    console.log('UPDATED');
  }

  const after = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, phone: true, passwordHash: true, staffRoleId: true },
  });
  const ok = bcrypt.compareSync(password, after.passwordHash);
  console.log('AFTER:', JSON.stringify({ id: after.id, hasPassword: !!after.passwordHash, staffRoleId: after.staffRoleId }));
  console.log('PASSWORD_VERIFY=', ok);
  await prisma.$disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
