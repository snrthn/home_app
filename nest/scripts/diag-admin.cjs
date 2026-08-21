// 只读诊断：列出 user 表中 role='admin' 的用户状态（不修改任何数据）
const fs = require('fs');
const envPath = 'D:/FrontEnd/home_app/nest/.env';
const envRaw = fs.readFileSync(envPath, 'utf8');
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
  if (m) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, '');
}
const { PrismaClient } = require('D:/FrontEnd/home_app/nest/node_modules/.prisma/client');
const prisma = new PrismaClient();

(async () => {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true, phone: true, passwordHash: true, staffRoleId: true, createdAt: true },
  });
  console.log('ADMIN_COUNT=', admins.length);
  for (const a of admins) {
    console.log(JSON.stringify({
      id: a.id,
      phone: a.phone,
      hasPassword: !!a.passwordHash,
      staffRoleId: a.staffRoleId,
      createdAt: a.createdAt,
    }));
  }
  await prisma.$disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
