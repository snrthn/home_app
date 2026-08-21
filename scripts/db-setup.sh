#!/usr/bin/env bash
# 一次性数据库初始化脚本（首次部署或新环境搭建时执行）。
# 流程：创建数据库 → Prisma 迁移 → 种子(权限/角色) → 初始化管理员
# 用法: 在服务器上执行一次
#   sudo MYSQL_ROOT_PASSWORD=xxx ADMIN_PASSWORD=你的强密码 bash scripts/db-setup.sh
#
# 依赖环境变量：
#   MYSQL_ROOT_PASSWORD  (必填) MySQL root 密码，用于建库
#   ADMIN_PASSWORD       (必填) 初始管理员密码，首次登录后请尽快修改
# 可选：
#   MYSQL_HOST(127.0.0.1) MYSQL_PORT(3306) DB_NAME(laoma_jiadian)
#   ADMIN_PHONE(admin)   ADMIN_NICKNAME(超级管理员)
#   DEPLOY_DIR(/usr/local/www/loama)
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/usr/local/www/loama}"
cd "$DEPLOY_DIR"

# 复用 nest/.env 里的 DATABASE_URL / JWT 等
if [ -f ./nest/.env ]; then
  set -a; . ./nest/.env; set +a
fi

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:?环境变量 MYSQL_ROOT_PASSWORD 未设置}"
DB_NAME="${DB_NAME:-laoma_jiadian}"
ADMIN_PHONE="${ADMIN_PHONE:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?环境变量 ADMIN_PASSWORD 未设置（初始管理员密码）}"
ADMIN_NICKNAME="${ADMIN_NICKNAME:-超级管理员}"

echo "==> [1/4] 创建数据库 $DB_NAME（如不存在）"
mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -uroot -p"$MYSQL_ROOT_PASSWORD" 2>/dev/null \
  -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "==> [2/4] 应用 Prisma 迁移"
( cd nest && npx prisma db push )

echo "==> [3/4] 种子：权限码与岗位角色（幂等）"
node nest/prisma/seed.js

echo "==> [4/4] 初始化管理员账号（幂等）"
ADMIN_PHONE="$ADMIN_PHONE" \
ADMIN_PASSWORD="$ADMIN_PASSWORD" \
ADMIN_NICKNAME="$ADMIN_NICKNAME" \
  node nest/scripts/init-admin.cjs

echo ""
echo "==> 数据库初始化完成"
echo "    管理员账号: $ADMIN_PHONE"
echo "    密码: 你设置的 ADMIN_PASSWORD"
echo "    后台地址: https://laoma.snrthn.com/admin"
echo "    安全提示: 请尽快登录后修改默认密码。"
