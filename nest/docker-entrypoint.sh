#!/bin/sh
# ===================================================================
# 后端容器入口：数据库同步 → 种子 → 启动应用
# 幂等，每次容器启动安全执行（与 deploy.sh 第 6/7 步一致）
# ===================================================================
set -e

echo "==> [1/5] 等待数据库就绪"
# DATABASE_URL 由 docker-compose 环境变量注入
if [ -z "$DATABASE_URL" ]; then
  echo "!! DATABASE_URL 未设置，请检查 .env.prod" >&2
  exit 1
fi

# 从 DATABASE_URL 解析 host:port 做存活探测
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_PORT=${DB_PORT:-3306}
echo "    目标数据库 $DB_HOST:$DB_PORT"

# 最多等 30 秒（用 node 探测，兼容 alpine 无 nc）
i=0
while [ $i -lt 30 ]; do
  if node -e "require('net').connect($DB_PORT,'$DB_HOST').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" 2>/dev/null; then
    echo "    数据库可达"
    break
  fi
  i=$((i + 1))
  echo "    等待数据库... ($i/30)"
  sleep 1
done

echo "==> [2/5] 同步数据库结构 (prisma db push)"
cd /app/nest
npx prisma db push --skip-generate --accept-data-loss

echo "==> [3/5] 种子数据（幂等）"
node prisma/seed.js
node prisma/seed-categories.js
node prisma/seed-items.js
node prisma/seed-content.js

echo "==> [4/5] 初始化管理员（如配置了 ADMIN_PASSWORD）"
if [ -n "$ADMIN_PASSWORD" ]; then
  ADMIN_PHONE="${ADMIN_PHONE:-admin}" \
  ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  ADMIN_NICKNAME="${ADMIN_NICKNAME:-超级管理员}" \
    node scripts/init-admin.cjs
  echo "    管理员账号: ${ADMIN_PHONE:-admin}"
else
  echo "    跳过（未设置 ADMIN_PASSWORD，请确保管理员已存在）"
fi

echo "==> [5/5] 启动 NestJS"
exec "$@"
