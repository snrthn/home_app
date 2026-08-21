// 给 phone='admin' 用户补 UserProfile（修复 updateAdmin 因缺 profile 报错的连锁坑）
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
  const phone = 'admin';
  const u = await prisma.user.findUnique({ where: { phone }, include: { profile: true } });
  if (!u) { console.log('ADMIN_NOT_FOUND'); process.exit(1); }
  console.log('ADMIN', u.id, 'hasProfile=', !!u.profile);
  if (!u.profile) {
    const p = await prisma.userProfile.create({ data: { userId: u.id, nickname: '超级管理员' } });
    console.log('PROFILE_CREATED', p.userId);
  } else {
    console.log('PROFILE_ALREADY_EXISTS nickname=', u.profile.nickname);
  }
  const after = await prisma.user.findUnique({ where: { phone }, include: { profile: true } });
  console.log('AFTER hasProfile=', !!after.profile, 'nickname=', after.profile && after.profile.nickname);
  await prisma.$disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
