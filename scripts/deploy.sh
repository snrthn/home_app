#!/usr/bin/env bash
# 服务器端部署脚本（SSH+PM2 方案）。
# 由 GitHub Actions 通过 SSH 调用，也可手动在服务器执行。
# 用法: bash scripts/deploy.sh [分支, 默认 main]
#
# 两种代码来源：
#   - 默认：本机 git pull（需 ECS 能访问 GitHub，国内常不稳定）
#   - SKIP_PULL=1：代码已由 CI 通过 scp 同步到 DEPLOY_DIR，跳过 git
#     （push-based，避免 ECS 访问 GitHub 的网络问题）
#
# 前置（首次）：
#   1. 服务器已装 git / pnpm@8 / pm2 / mysql
#   2. 仓库已克隆到 DEPLOY_DIR（或由 CI scp 同步）
#   3. nest/.env 已放置生产环境变量
#   4. next/.env.production 已配置 NEXT_PUBLIC_API_BASE=/api
set -euo pipefail

BRANCH="${1:-main}"
DEPLOY_DIR="${DEPLOY_DIR:-/usr/local/www/loama}"

echo "==> [1/7] 拉取代码 ($BRANCH)"
cd "$DEPLOY_DIR"
if [ "${SKIP_PULL:-0}" = "1" ]; then
  echo "    SKIP_PULL=1，代码已由 CI 同步，跳过 git fetch/reset/clean"
else
  git fetch --all --prune
  git reset --hard "origin/$BRANCH"
  git clean -fd   # 清理未跟踪文件，避免构建污染
fi

echo "==> [2/7] 安装依赖"
pnpm install --frozen-lockfile

echo "==> [3/7] 生成 Prisma Client"
pnpm --filter @laoma/backend exec prisma generate

echo "==> [4/7] 构建各包 (turbo)"
pnpm build

echo "==> [5/7] 加载 nest/.env 到当前 shell 环境"
# nest 的 seed / init-admin 等独立 node 进程不走 ConfigModule，
# 需在此显式导入 DATABASE_URL 等变量。
if [ -f ./nest/.env ]; then
  set -a
  . ./nest/.env
  set +a
else
  echo "!! 缺少 nest/.env，请在服务器上先放置生产环境变量文件" >&2
  exit 1
fi

echo "==> [6/7] 数据库迁移 + 种子（均幂等，可重复执行）"
( cd nest && npx prisma db push )
node nest/prisma/seed.js
node nest/prisma/seed-categories.js

echo "==> [7/7] 重载 PM2 进程"
pm2 startOrReload ecosystem.config.js
pm2 save

echo "==> 部署完成"
pm2 list