# ============== 构建阶段 ==============
FROM node:18-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

# 复制 workspace 配置
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY nest/package.json ./nest/package.json
COPY next/package.json ./next/package.json
COPY shared/package.json ./shared/package.json

# 安装全部依赖（构建需要）
RUN pnpm install --frozen-lockfile

# 复制源码
COPY nest ./nest
COPY next ./next
COPY shared ./shared

# 生成 Prisma Client + 构建全部包
RUN cd /app/nest && npx prisma generate
RUN pnpm build

# ============== 运行阶段 ==============
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3721

# 只复制生产依赖 + 构建产物
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/nest/package.json ./nest/package.json
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist

# 只安装生产依赖
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate \
    && pnpm install --frozen-lockfile --prod

# 复制 nest 构建产物 + prisma schema（运行时 db push 需要）
COPY --from=builder /app/nest/dist ./nest/dist
COPY --from=builder /app/nest/prisma ./nest/prisma
COPY --from=builder /app/nest/config ./nest/config
COPY --from=builder /app/nest/scripts ./nest/scripts
COPY --from=builder /app/nest/node_modules/.prisma ./nest/node_modules/.prisma
COPY nest/docker-entrypoint.sh ./nest/docker-entrypoint.sh

# 安装 prisma CLI（运行时 db push 需要，prod install 不含 devDeps）
RUN npm install -g prisma@5.12.0 \
    && chmod +x ./nest/docker-entrypoint.sh

EXPOSE 3721

# 健康检查（给足时间让 db push + seed 跑完）
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3721/api/v1/config/public', r => process.exit(r.statusCode === 200 ? 0 : 1))"

# 入口：db push → 种子 → 启动应用（entrypoint 内 cd /app/nest）
ENTRYPOINT ["./nest/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
