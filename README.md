# 老马家政家电（laoma-jiadian）

家政 / 家电服务平台的单体仓库（monorepo），前端 + 后端 + 共享包统一管理。

## 技术栈

| 分层 | 技术 | 目录 | 端口 |
|---|---|---|---|
| 前端 | Next.js 14（App Router）+ React 18 + Tailwind + TanStack Query + Zustand | `next/` | 3824 |
| 后端 | NestJS 10 + Prisma 5 + MySQL 8 + JWT | `nest/` | 3721 |
| 共享 | TypeScript 类型 / 常量（`@laoma/shared`） | `shared/` | — |

- 包管理：**pnpm 8 workspace** + **Turborepo 2**
- 全局 API 前缀：`/api`；后端静态资源：`/uploads`

## 目录结构

```
home_app/
├─ package.json        # 根：统一 dev / build / typecheck 入口（turbo run）
├─ turbo.json          # turbo 任务编排
├─ pnpm-workspace.yaml # workspace 包声明
├─ nest/              # @laoma/backend  NestJS 后端
├─ next/              # @laoma/frontend Next.js 前端
└─ shared/            # @laoma/shared  共享类型与常量
```

## 环境要求

- Node ≥ 18（推荐 20+）
- pnpm 8.15.4（见根 `package.json` 的 `packageManager`）
- 一个可连接的 MySQL 8 实例（连接串在 `nest/.env`）

## 快速开始

### 1. 安装依赖（根目录，一次装全部包）

```bash
pnpm install
```

### 2. 配置后端环境变量

复制 `nest/.env.example`（如有）或新建 `nest/.env`，至少包含：

```ini
DATABASE_URL="mysql://user:password@localhost:3306/laoma"
JWT_SECRET="your-secret"
PORT=3721
```

### 3. 初始化数据库（首次 / 迁移变更时）

```bash
pnpm prisma:generate   # 生成 Prisma Client
pnpm prisma:migrate    # 执行迁移（等价于 prisma migrate dev，作用于 @laoma/backend）
```

> 根脚本已通过 `pnpm --filter @laoma/backend exec` 定向到后端，`nest/` 目录内也可直接 `pnpm prisma:generate` / `pnpm prisma:migrate`。

### 4. 启动开发服务

**推荐：根目录一条命令同时拉起前后端**

```bash
pnpm dev
```

- 等价于 `turbo run dev`，并行启动：
  - 前端：`next dev -p 3824`（热更新）
  - 后端：`nest start --watch`（热更新，脚本为 `nest` 的 `dev`）
- 访问：前端 http://localhost:3824 ，后端 API http://localhost:3721/api

> 说明：后端 `nest new` 脚手架默认只有 `start:dev`、没有 `dev` 脚本，这里已补齐 `"dev": "nest start --watch"`，使根 `pnpm dev` 能真正同时驱动两端。若只想单独启动某端，见下方「单独启动」。

### 5. 类型检查 / 生产构建

```bash
pnpm typecheck   # 两端 tsc --noEmit
pnpm build       # 两端分别 build：前端 .next/，后端 dist/
```

## 单独启动 / 生产运行

| 场景 | 命令 | 说明 |
|---|---|---|
| 仅前端（开发） | `cd next && pnpm dev` | `next dev -p 3824` |
| 仅后端（开发） | `cd nest && pnpm dev` 或 `pnpm start:dev` | `nest start --watch` |
| 仅前端（生产） | `cd next && pnpm build && pnpm start` | `next start -p 3824` |
| 仅后端（生产） | `cd nest && pnpm build && pnpm start:prod` | `node dist/main`（需先 build） |

> 生产部署通常是两个独立进程（3824 / 3721），建议交给进程管理器（pm2 / systemd / Docker）。`pnpm start`（后端）为 `nest start` 开发式 runner，生产请用 `start:prod`。

## 可用脚本一览

**根目录**
| 脚本 | 等价 |
|---|---|
| `pnpm dev` | `turbo run dev` |
| `pnpm build` | `turbo run build` |
| `pnpm typecheck` | `turbo run typecheck` |
| `pnpm prisma:generate` | `pnpm --filter @laoma/backend exec prisma generate` |
| `pnpm prisma:migrate` | `pnpm --filter @laoma/backend exec prisma migrate dev` |
| `pnpm prisma:studio` | `pnpm --filter @laoma/backend exec prisma studio` |

**后端 `nest/`**
| 脚本 | 命令 | 语义 |
|---|---|---|
| `dev` | `nest start --watch` | 开发热重载（被根 `pnpm dev` 调用） |
| `build` | `nest build` | 编译 TS 到 `dist/` |
| `start` | `nest start` | ⚠️ 开发态 runner（非生产），仅本地调试用，**勿用于生产部署** |
| `start:prod` | `node dist/main` | ✅ 生产启动（必须先 `build`），上生产用它 |
| `start:dev` | `nest start --watch` | 同 `dev`，老别名 |
| `typecheck` | `tsc --noEmit` | 类型检查 |
| `prisma:generate` / `prisma:migrate` | `prisma generate` / `prisma migrate dev` | Prisma 客户端生成 / 开发期迁移 |

> ⚠️ **脚本语义红线**：`start` 是 `nest start`（开发式 runner，监听文件、不跑构建产物），
> 生产必须 `build` 后再 `start:prod`。不要把 `start` 当生产命令上线，否则跑的是源码且缺产物。

**前端 `next/`**
| 脚本 | 命令 |
|---|---|
| `dev` | `next dev -p 3824` |
| `build` | `next build` |
| `start` | `next start -p 3824` |
| `typecheck` | `tsc --noEmit` |

## 角色与路由

前端三个角色独立路由前缀，登录前仅 `/login` 可访问，其余由 `next/src/middleware.ts` 做前置拦截：

| 角色 | 路由前缀 | 首页 |
|---|---|---|
| 客户 | `/client` | `/client` |
| 师傅 | `/master` | `/master` |
| 管理员 | `/admin` | `/admin` |

白名单与拦截规则集中在 `next/src/lib/route-guards.ts`，改白名单只改这一处。

## 其他说明

- 上传：后端 `POST /api/upload`（JWT 鉴权，存 `nest/uploads/`，`/uploads` 静态服务已开启）。
- 密码登录 / 验证码（注册）登录 / 管理员登录 三种方式见 `next/src/app/(auth)/login/page.tsx`。
- 个人中心密码设置以弹窗形式提供（`components/form/PasswordDialog`），提交 `POST /api/auth/password`。
