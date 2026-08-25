# ============== 构建阶段 ==============
FROM node:18-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

# 复制 workspace 配置
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY nest/package.json ./nest/package.json
COPY next/package.json ./next/package.json
COPY shared/package.json ./shared/package.json

# 安装全部依赖
RUN pnpm install --frozen-lockfile

# 复制源码
COPY nest ./nest
COPY next ./next
COPY shared ./shared

# 构建 shared + Next.js
RUN pnpm --filter @laoma/shared build
RUN pnpm --filter @laoma/frontend build

# ============== 运行阶段 ==============
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3824

# 只复制生产依赖
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/next/package.json ./next/package.json
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate \
    && pnpm install --frozen-lockfile --prod

# 复制 Next.js 构建产物
COPY --from=builder /app/next/.next ./next/.next
COPY --from=builder /app/next/public ./next/public
COPY --from=builder /app/next/next.config.js ./next/next.config.js
COPY --from=builder /app/next/postcss.config.js ./next/postcss.config.js
COPY --from=builder /app/next/tailwind.config.ts ./next/tailwind.config.ts

EXPOSE 3824

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3824', r => process.exit(r.statusCode === 200 ? 0 : 1))"

WORKDIR /app/next
CMD ["node_modules/.bin/next", "start", "-p", "3824"]
