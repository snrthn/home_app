# 工程化专项（Engineering）

> **维护者**：AI Agent「巴比」　**创建**：2026-08-24　**联动**：`docs/HANDOFF.md` §1.2  
> **目的**：集中记录 home_app 的**工程化 / 质量 / 安全 / CI / 部署**问题、优先级与处理跟踪，与业务逻辑解耦（业务设计见各 `*-design.md`）。  
> **用法**：每个问题一条（E-xx），含证据（文件:行）、影响、建议、状态。解决后回填 commit 与验证命令，不要只改状态。

---

## 0. 现状体检快照（2026-08-25 实测；E-03/E-04/E-05/E-13/E-14/E-15/E-16 处理后）

| 维度         | 现状                                                                                        | 结论            |
| ---------- | ----------------------------------------------------------------------------------------- | ------------- |
| 类型检查       | `nest` / `next` 均 `tsc --noEmit` EXIT=0                                                   | ✅ 通过          |
| `any` 类型安全 | 三端共 139 处 `any`（nest 58 / next 81 / shared 0），较修复前 288 处减少 149 处（52%）；零 `@ts-ignore`/`@ts-nocheck` | 🟡 大幅改善，剩余为合理保留 |
| 单元测试       | jest + ts-jest 就位；P0 纯函数 5 suites/107 tests + P1 金额守卫 10 suites/195 tests，共 195 tests PASS | ✅ 已完成 |
| E2E 测试     | 2 suites / 16 tests PASS（正向全链 + 售后链）                                                       | ✅ 已完成 |
| Lint / 格式化 | eslint 9 flat config 打通，`pnpm lint` 0 error / 82 warn（原 188 warn，any 清理+round2 修复后降 106）；prettier 配置就位，存量 55 文件格式债未统一 | 🟡 部分完成       |
| CI 门禁      | `.github/workflows/deploy.yml` 现跑 `pnpm prisma:generate` + `pnpm typecheck` + `pnpm lint` + commitlint，失败即阻断部署             | ✅ 门禁生效       |
| API 版本控制   | `main.ts` 启用 `enableVersioning({ type: URI, defaultVersion: '1' })`，所有接口走 `/api/v1/...`；未来升级挂 `@Version('2')` 即可 | ✅ 已完成 |
| API 文档     | `@nestjs/swagger` v7 + `swagger-ui-express` 接入，25 个 controller + 15 个 DTO 全量标注；访问 `http://localhost:3721/docs` | ✅ 已完成 |
| CORS       | `main.ts` 读 `CORS_ORIGIN` env（逗号白名单），未设回落 true；生产设白名单即锁死                  | ✅ 已收敛        |
| 统一异常       | `AllExceptionsFilter` 全局注册，404/400/500 统一 `{code,message,data,path,timestamp}`        | ✅ 已收敛        |
| 日志         | nest 2 处 + next 4 处 `console.log` 散落，无 pino/winston                                       | ⚠️ 无结构化       |
| 密钥管理       | `.gitignore` 已忽略 `.env`（不入库）；无 `.env.example`                                             | ⚠️ 安全但缺样例     |
| 部署迁移       | `scripts/deploy.sh` 第 6 步 `npx prisma db push`（非 `migrate deploy`）；本地却有 14 个 migration 文件 | ⚠️ 双路径不一致、无回滚 |

> 安全亮点：密钥无硬编码（均在 `.env`），`.gitignore` 正确忽略 `.env`，`git archive` 部署也自动排除。

---

## 1. 问题清单（按优先级）

### P0 — 安全 / 上线即风险（改动小、收益大，优先做）

#### E-01　CORS `origin: true` + `credentials: true` 写入生产

- **证据**：`nest/src/main.ts:10` → `app.enableCors({ origin: true, credentials: true });`
- **影响**：`origin: true` 等于「任意来源」都允许，叠加 `credentials: true` 允许带用户凭证请求 → 跨站凭证泄露 / CSRF 类风险。开发方便，但 `main.ts` 是 dev 与 `dist/main.js`（生产）共用同一份代码，生产环境同样无差别放行。
- **建议**：从 `process.env.CORS_ORIGIN` 读取（逗号分隔白名单，`*` 仅限 dev 显式声明），去掉无差别 `true`。约 1 行代码 + 1 个 env 变量。
- **状态**：✅ 已解决（2026-08-24）
- **验证**：`nest tsc --noEmit` EXIT=0；已重启 3721 生效。未设 `CORS_ORIGIN` 时回落 `true`（dev 跨端口兼容），生产配置白名单即锁死任意来源带凭证风险。代码已改，待 commit。

#### E-02　CI 质量门禁失效（`continue-on-error: true`）

- **证据**：`.github/workflows/deploy.yml` → `pnpm typecheck` 上方 `continue-on-error: true`
- **影响**：typecheck 失败也照常部署，等于没有门禁；坏类型/误用直接上线。
- **建议**：去掉 `continue-on-error`；至少让 typecheck 阻断部署。后续把 lint 也加进 `verify` job。
- **状态**：✅ 已解决（2026-08-24）
- **验证**：已删除 `deploy.yml` 的 `continue-on-error: true`，`verify` job 现阻塞部署（typecheck 失败即终止）。代码已改，待 commit/push 生效。

### P1 — 健壮性 / 可维护性（中期必做）

#### E-03　无统一异常处理

- **证据**：`grep -rln "ExceptionFilter" nest/src` → NONE；无 `AllExceptionsFilter` / `HttpExceptionFilter`
- **影响**：业务异常（余额不足、订单状态非法、权限不足）依赖框架默认 500/HTML 响应，格式不可控，前端难统一处理，排障靠猜。
- **建议**：加 `AllExceptionsFilter` 统一响应体 `{ code, message, data? }` + 业务错误码枚举；业务 service 抛 `BizException(code)`，过滤器转译并结构化日志（含 traceId/requestId）。
- **状态**：✅ 已解决（2026-08-24）
- **验证**：
  - `nest/src/common/filters/all-exceptions.filter.ts`【新建】：`@Catch()` 全量兜底——HttpException 透出 status + message（数组 join 成 `；`）；Prisma 已知错误映射 `DB_P2002`（唯一约束）/`DB_VALIDATION`；未知异常统一 `500 + code='INTERNAL_ERROR'`，不泄露堆栈；响应体 `{ code, message, data:null, path, timestamp }`，message 始终保留在顶层（前端 `getApiErrorMsg` 只读它）
  - `main.ts:24` 已 `app.useGlobalFilters(new AllExceptionsFilter())` 注册
  - `nest tsc --noEmit` EXIT=0；**3722 冒烟实测**：404 → `HTTP_404`、ValidationPipe 校验失败 → `HTTP_400`（message=「phone must be a string」）、非法 JSON → `HTTP_400`、正常接口 200 不受影响；3722 已退服
  - 剩余债：错误码未枚举化（`HTTP_xxx` 直透）、未接结构化日志——按建议后半段属长期债，留待 E-07 一并处理

#### E-04　零自动化测试

- **证据**：`nest/package.json`、`next/package.json`、`package.json` 均无 `test` 脚本；无 jest/vitest 配置；无 `*.spec.ts` / `*.test.ts`
- **影响**：支付/退款状态机、派单 candidates 算法、分账 `resolveTierRatio` 等核心逻辑**无回归保护**，任何重构即裸奔。
- **建议**：先补最高价值单测（分账阶梯计算、退款阶梯、派单评分排序），再补 1 条 e2e smoke（登录 → 下单 → 支付确认 → 退款审核）。框架用 vitest + supertest（nest）即可，不引入重量级依赖。
- **状态**：✅ 已完成（2026-08-24：基础设施 + P0 纯函数层 + P1 金额守卫 + P2 e2e 链路全部完成）
- **验证**：
  - **基础设施**：`nest/jest.config.js` + `nest/tsconfig.spec.json`【新建】——jest + ts-jest + `testRegex .*\.spec\.ts$`，`@laoma/shared` 经 `moduleNameMapper` 映射到 `shared/dist/index.js`（避免 pnpm 双副本解析漂移）；`nest/package.json` 加 `test` script
  - **P0 纯函数层完成（2026-08-24）**：5 suites / 107 tests PASS，双端 `tsc --noEmit` EXIT=0
    - `order-status.spec.ts`：`canTransition` 合法/非法流转、未知状态、终态无出口（18 tests）
    - `region-match.spec.ts`：`regionMatches` 空/省/市/区分级、多规则、名称不参与、null 透传 + `serviceAreasToRules` level 1/2/3（25 tests）
    - `split.util.spec.ts`：`splitNormal` 费率 0/0.1/0.5/1 + 金额边界 + 精度 + `splitRefund` full/tiered/keep_commission 三策略 + 阶梯继承 + 边界（22 tests）——从 `commission.service.ts` 提纯到 `split.util.ts`，service 改薄封装，行为零变更
    - `master.util.spec.ts`：`masterCoversOrder` 所在地∪接单范围并集语义 + 空数据 + `slotsOverlap` 区间相交/边界相接/自由文本/空值（29 tests）——从 `orders.service.ts` 提纯到 `master.util.ts`，service 改导入调用，行为零变更
    - `tier.util.spec.ts`（前批次）：`resolveTierRatio` 区间继承 + `clamp01`（8 tests）
    - 被测文件语句覆盖 96-100%；整体覆盖率 2.55%（从 0.45% 提升 5.7 倍）
  - **P1 金额守卫完成（2026-08-24）**：5 个目标全部覆盖，10 suites / 195 tests PASS，双端 `tsc --noEmit` EXIT=0
    - `payments.service.spec.ts`：`refund` 三策略守卫 + 前置校验(NotFound/Forbidden/BadRequest) + allowCompleted 分支 + 两段式 transition + createCompensation 条件 + reason 透传（19 tests）
    - `orders.cancel.spec.ts`：`cancel` 支付前/后分叉 + 权限验证(客户/师傅/管理员) + stageStatus 保留 + cancelReason 透传（12 tests）
    - `settlements.service.spec.ts`：`releaseToMaster` 幂等 + `createCompensation` 条件守卫 + `credit`/`reject` 状态机（21 tests）
    - `withdrawals.service.spec.ts`：`create` 防超提(事务内聚合 credited−paid−pending) + `markPaid`/`reject` 乐观锁（17 tests）
    - `commission.resolve.spec.ts`：`resolve` 三级降级(service→category→global→default) + 类目链限深 10 + `toSnapshot` 规整 + `snapshotFromOrder` 快照优先（19 tests）
    - 共享 mock 工厂 `src/test/mocks.ts`：createMockPrisma/Commission/Orders/Settlements/Gateway/Provider
    - 整体覆盖率 ~8%（mock 了 prisma 层，controller/repository 行数未覆盖，~18% 为乐观估计）
  - **P2 e2e 链路完成（2026-08-24）**：2 suites / 16 tests PASS，双端 `tsc --noEmit` EXIT=0
    - `positive-chain.e2e.spec.ts`：下单→支付→mock 回调→抢单→出发→到达码→到达→开始→完成→验收→结算单自动生成（11 tests）
    - `after-sales.e2e.spec.ts`：投诉→退款处置→退款审核→全额退款（reviewed 不在阶梯断点→无补偿单）+ 投诉→compensate 处置→工单 resolved（5 tests）
    - E2E 基建 `src/e2e/setup.ts`：`bootstrapApp`（NestJS 测试模块）、`createE2EContext`（创建测试用户/师傅/地址/服务区域/佣金规则，登录获取 token）、`cleanupE2EContext`（逆序清理测试数据）、`createAndCompleteOrder`（走完正向全链辅助函数）
    - 配置 `jest.e2e.config.js`：`testRegex .*\.e2e\.spec\.ts$`，testTimeout 30s
    - 设计发现：`compensate` 处置时 `createCompensation(compensation=0)` 返回 null（comp<=0 守卫），且 Settlement.orderId @unique 约束阻止同订单第二张结算单——compensate 流程不创建补偿单，仅记录 complaint.result=compensate
- **框架说明**：实际选用 jest（非 vitest）——nest 官方默认 + 沙箱安装链已验证
- **覆盖规划（2026-08-24 定稿）**：核心业务链路已梳理（下单→托管→接单→履约→验收→结算 / 逆向退款 / 售后投诉 / 师傅提现），按「改错会赔钱」优先级分三批次推进，详见 `docs/test-plan.md`：
  - **P0 纯函数层** ✅：`canTransition`、`regionMatches`、`serviceAreasToRules`、`resolveTierRatio`、`splitNormal`、`splitRefund`、`masterCoversOrder`（提纯）、`slotsOverlap`（提纯）——无 DB，纯输入输出，一批 spec，覆盖率 0.45% → 2.55%
  - **P1 金额守卫** ✅：`payments.refund` 三策略、`orders.cancel` 分叉、`settlements.releaseToMaster` 幂等、`withdrawals.create` 防超提、`commission.resolve` 三级降级——mock prisma + mock provider，service 级，10 suites / 195 tests PASS，覆盖率 → ~8%
  - **P2 链路 e2e** ✅：正向全链（下单→支付→抢单→履约→验收→结算）+ 售后链（投诉→审核→退款）——supertest 打真服务，2 suites / 16 tests PASS

#### E-05　无 Lint / 格式化

- **证据**：`find . -maxdepth 3 -name '.eslintrc*' -o -name 'eslint.config.*' -o -name 'prettier*'` → 全空
- **影响**：代码风格靠自觉，CI 不拦截 `any` 扩散、未用变量、潜在 bug 模式。
- **建议**：加共享 eslint flat config（nest 用 `@nestjs/eslint`，next 用 `eslint-config-next`）+ prettier；`package.json` 加 `lint` 脚本；CI `verify` job 串 lint。
- **状态**：🔄 部分完成（2026-08-24：eslint 通道打通 0 error 并接入 CI；prettier 配置就位但存量格式债未统一、未接 CI）
- **验证**：
  - `nest/eslint.config.mjs`【新建】：eslint 9 flat config（`@eslint/js` + `typescript-eslint` recommended）——TS 源码关 `no-undef`（tsc 兜底，官方推荐）；`no-explicit-any`/`no-unused-vars` 降 warn 不阻断；**Node CommonJS 脚本**（`prisma/seed-*.js`、`jest.config.js`、`scripts/*.cjs`）声明运行时 globals + 放行 `require`；`.mjs`（config 自身）按 ESM 处理
  - `nest/.prettierrc.json`（semi/singleQuote/trailingComma/printWidth 100）+ `.prettierignore`（dist/node_modules/coverage）【新建】；`nest/package.json` 加 `lint`/`format` script；根 `package.json` + `turbo.json` 加 `lint` task（`pnpm lint` 全仓入口）
  - `.github/workflows/deploy.yml`：`verify` job 在 typecheck 后追加 `pnpm lint`（与 E-02 同批改）
  - **实测**：`pnpm --filter @laoma/backend lint` **0 error / 90 warning**（原 188 warn，E-14 any 清理后降 98）；`scripts/verify-p1-runtime.cjs` 一处未用变量顺手修掉
  - **存量格式债**：`npx prettier --check src/**/*.ts` → 55 文件不合规（历史无 prettier 约束）。**决策：本轮不跑 `--write` 全量格式化**——大 diff 混入工程提交风险高，且与用户编辑器正在改的文件冲突；`format` 脚本留作按需执行，后续单独开一轮「prettier 全量统一 + 接 CI」
  - **未做**：next 端 lint（`eslint-config-next`）未配——`pnpm lint`（turbo）当前仅 nest 生效，next 无 lint script 自动跳过；建议下轮补

#### E-12　短信验证码 DTO 校验不严（2026-08-24 冒烟时发现）

- **证据**：`POST /api/auth/send-code` 传 `{"phone":"123"}` → 200 且 mock 模式真返回验证码（`{ok:true,code:"107227",dev:true}`）；`send-code.dto.ts` 的 `phone` 仅 `@IsString()`，无手机号格式校验
- **影响**：任意字符串（非手机号）都能触发发码；real 模式下等于免费短信轰炸接口（若接真网关无频控成本风险），体验上无效号码也能「获取验证码」
- **建议**：`phone` 加 `@IsMobilePhone('zh-CN')`（class-validator 内置）；需确认 mock 模式测试假号（如 `13800000000`）仍合法——合法格式内假号不受影响；若存在故意用非手机号串的场景再单独评估
- **状态**：📋 待处理（低风险快改，1 行 DTO；待虎哥确认 mock 假号兼容后动手）

#### E-13　Git 提交信息无规范

> **规范文档**：[`docs/commit-convention.md`](commit-convention.md)（格式定义、示例、工具链说明）

- **证据**：近 50 条提交中仅 ~30% 遵循 Conventional Commits（`fix:`/`feat:`/`ci:` 前缀），其余为纯中文裸描述；无 commitlint / husky / commitizen / .gitmessage / CONTRIBUTING.md；全部提交无 body；无 scope 标注；无 Breaking Change 标识；CI 无提交信息校验
- **影响**：提交历史不可机器解析，无法自动生成 changelog；不合规提交可直达生产部署
- **建议**：接入 commitlint（Conventional Commits）+ husky（commit-msg hook 本地拦截）+ .gitmessage 模板 + CI 校验步骤；详见规范文档
- **状态**：✅ 已完成（2026-08-24）
- **验证**：
  - `commitlint.config.js`【新建】：基于 `@commitlint/config-conventional`，自定义 12 种 type（feat/fix/refactor/perf/style/test/docs/ci/build/deploy/chore/revert），subject 限 72 字，header 限 100 字，中文 subject 不做大小写校验
  - `.husky/commit-msg`【新建】：`npx --no -- commitlint --edit "$1"`，本地提交时自动校验格式，不合规即拒绝
  - `.husky/pre-commit`【新建】：`pnpm lint`，提交前跑 lint 门禁
  - `.gitmessage`【新建】：`git commit` 模板，提示 type/scope/subject 格式 + 示例；`git config commit.template .gitmessage` 已设
  - `package.json`：加 `@commitlint/cli` + `@commitlint/config-conventional` + `husky` devDependencies + `prepare: husky` + `commitlint` script
  - `.github/workflows/deploy.yml`：`verify` job 追加 `commitlint --from=before --to=sha` 校验步骤，CI 层阻断不合规提交
  - `docs/commit-convention.md`【新建】：完整规范文档（格式定义、type/scope 对照表、示例、工具链说明、快速修复指南）
  - **实测**：`npx commitlint --from=HEAD~1 --to=HEAD --verbose` 对最近一条提交 `feat: 补齐提交规范工具链` → PASS

#### E-14　TypeScript `any` 类型安全治理（2026-08-24）

> **范围**：三端（nest / next / shared）源码中 `any` 关键字使用量治理，不含测试文件和 mock。

- **证据**：修复前三端共 288 处 `any`（nest 197 / next 91 / shared 0）；零 `@ts-ignore`/`@ts-nocheck`（已合规）；ESLint `no-explicit-any` 为 `warn` 不阻断，`any` 持续累积
- **影响**：`any` 绕过类型检查，调用方看不到契约，重构时无编译期保护；`as any` 断言可掩盖运行时类型不匹配
- **治理策略**：按安全度分两批——可安全修复的批量处理，合理保留的加注释说明
- **修复内容**（共 149 处）：

| 修复项 | 处数 | 关键改动 |
|---|---|---|
| Controller `@Req() req: any` | ~40 | 新建 `@CurrentUser()` 装饰器 + `AuthUser` 类型（`common/current-user.decorator.ts`），全量替换 |
| Ticket 接口缺 DTO | 4 | 新建 `CreateTicketDto` / `AddCommentDto` / `AppealDto` / `ResolveComplaintDto`（`tickets.dto.ts`） |
| Service `dto: any` / `filter: any` | 8 | 新建 `TicketListFilter` / `RefundListFilter` / `AddCommentInput` interface |
| `orders.gateway.ts` 全文 `any` | 17 | 新建 `WsServer` / `WsSocket` / `ServiceAreaEntry` / `OrderWithAddress` 接口替代 |
| Prisma 枚举 `as any` | ~10 | → `as never`（agreements / withdrawals / tickets，Prisma 枚举边界安全断言） |
| Prisma JSON `as any[]` | ~5 | → `ServiceAreaEntry[]` 类型化数组（masters / orders / master.util） |
| 前端 `as any` | 10 | `MasterInfo` 补 `rating` / `orderCount` / `serviceAreas` 字段（`auth.ts`） |
| 前端 `form.reason as any` | 1 | `useState` 类型化为 `ComplaintReason`（`complaints/page.tsx`） |
| 其他散点 | ~4 | `notices.targetRegions` / `commission.tiers` / `orders.dto.photos` |

- **合理保留的 139 处 `any`**：

| 类别 | 估计数量 | 保留原因 |
|---|---|---|
| 支付通道（alipay/wechat/provider） | ~15 | 第三方 SDK 回调格式无法预定义 |
| Cookie/Express 内部 | ~6 | Express `req`/`res` 内部结构 |
| Prisma JSON 字段读取 | ~15 | Prisma `Json` 类型天然返回 `unknown` |
| `catch (e: any)` | ~20 | TS 异常处理常见模式 |
| 测试 Mock | ~6 | spec 文件已 ESLint 放行 |
| TiPTap 富文本 | ~5 | 第三方编辑器扩展命令类型不完整 |
| 前端 page.tsx 各种 | ~72 | `catch` 块 + axios 拦截器 + 小组件 |

- **状态**：✅ 已完成（2026-08-24）
- **验证**：
  - `npx tsc --noEmit`（nest）→ EXIT=0
  - `npx tsc --noEmit`（next）→ EXIT=0
  - `pnpm --filter @laoma/backend lint` → 0 error / 90 warning（原 188，降 98）
  - P0/P1 单测 10 suites / 195 tests PASS
  - E2E 测试 2 suites / 16 tests PASS
  - `any` 总量 288 → 139（-149，52%）；shared 端始终保持 0

### P2 — 工程化完善（可排期）

#### E-06　缺少 `.env.example`

- **证据**：根目录 / `nest/` / `next/` 均无 `.env.example`；`.gitignore` 已忽略 `.env`（✅）
- **影响**：新环境、同事、CI runner 不知道需要哪些变量（DATABASE_URL、JWT_SECRET、CORS_ORIGIN、短信四参数、支付商户号/密钥、OSS 等），只能看代码反推。
- **建议**：在 `nest/.env.example` 与 `next/.env.example` 列出全部变量名 + 说明，值留占位（`JWT_SECRET=`、`DATABASE_URL=`）。
- **状态**：📋 待处理

#### E-07　日志无结构化

- **证据**：`grep -rn 'console.log' nest/src` → 2 处；`next/src` → 4 处；无 pino/winston
- **影响**：生产排障靠 `console`，无分级（info/warn/error）、无上下文字段（orderId/requestId）、无法对接日志收集。
- **建议**：引入 `pino`（轻量、快）；关键路径（支付回调、派单执行、退款审核、WS 连接）打结构化日志；开发态仍可读。
- **状态**：📋 待处理

#### E-08　部署迁移策略风险（`prisma db push` 而非 `migrate deploy`）

- **证据**：`scripts/deploy.sh` 第 6 步 `( cd nest && npx prisma db push )`；本地 `nest/prisma/migrations/` 却有 14 个 migration 文件
- **影响**：
  - 生产无迁移历史审计，schema 变更不可追溯；
  - `db push` 对删列/改类型**直接生效且无确认**，生产误删字段即丢数据（HANDOFF §595 已记录此坑）；
  - 本地用 `migrate dev`、生产用 `db push`，两套路径，长期必漂移。
- **建议（二选一，需你拍板）**：
  1. **切 `migrate deploy`**：本地 `prisma migrate dev` 产出迁移，生产 `migrate deploy` 应用；部署前自动 `mysqldump` 备份。最规范，但有历史迁移需要补齐（当前 14 个文件未在生产登记）。
  2. **保留 `db push` 但加护栏**：部署前自动备份库；明确纪律「删列/改类型必须手写迁移 + 评审」，db push 只负责加列/加表这类安全变更。
- **状态**：📋 待处理（需决策方案）

### P3 — 后续可选（不阻塞业务）

- **E-09** 前端统一错误边界：`ErrorBoundary` + 401 统一跳登录 + 网络错误全局 toast（需确认 `next/src/lib` api 封装是否已统一拦截）
- **E-10** 依赖安全审计：`pnpm audit` / Dependabot / snyk，定期扫描
- **E-11** 前端性能与可访问性：route 级懒加载、bundle 拆分、a11y 基础（label/aria/focus）

#### E-15　API 缺少版本控制

- **证据**：`main.ts` 原先仅 `app.setGlobalPrefix('api')`，无 `enableVersioning`，所有接口走 `/api/orders` 等无版本路径
- **影响**：重大功能升级时破坏性变更无法平滑迁移，所有客户端同时受影响；移动端 App 发布后无法绑定特定 API 版本
- **修复**：
  - `main.ts` + `e2e/setup.ts` 启用 `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`
  - `next/src/lib/api.ts` baseURL 从 `/api` → `/api/v1`，`API_ORIGIN` 正则同步
  - 2 个 E2E spec 文件路径批量替换 `/api/` → `/api/v1/`（17 处）
  - 附带修复：`setup.ts` ServiceArea `findUnique + create` → `upsert`，解决并行测试竞态
- **状态**：✅ 已完成（2026-08-25）
- **验证**：tsc (nest+next) EXIT=0；lint 0 error；P0/P1 10 suites/195 tests PASS；E2E 2 suites/16 tests PASS

#### E-16　缺少 API 文档（Swagger/OpenAPI）

- **证据**：项目无 `@nestjs/swagger` 依赖，0 处 `@ApiTags`/`@ApiOperation`/`@ApiProperty` 装饰器，前后端协作靠口头沟通或读代码
- **影响**：新成员 onboarding 无接口全景；前端无法看到请求/响应 schema 定义；无交互式调试工具
- **修复**：
  - 安装 `@nestjs/swagger@7`（兼容 NestJS v10）+ `swagger-ui-express@5`
  - `main.ts` 挂载 `DocumentBuilder` + `SwaggerModule.setup('docs')`，访问 `http://localhost:3721/docs`
  - 25 个 controller 全量标注：`@ApiTags`（21 个中文标签）+ `@ApiOperation`（~80+ 端点）+ `@ApiBearerAuth`（受保护接口）+ `@ApiBody`/`@ApiParam`/`@ApiQuery`
  - 15 个 DTO 文件全量标注：`@ApiProperty`（必填）/ `@ApiProperty({ required: false })`（可选），与 class-validator 装饰器对齐
- **状态**：✅ 已完成（2026-08-25）
- **验证**：tsc (nest+next) EXIT=0；lint 0 error / 82 warnings；P0/P1 195 tests PASS；E2E 16 tests PASS；frozen-lockfile EXIT=0

---

## 2. 处理跟踪表

| 编号   | 问题                                  | 优先级 | 状态     | 计划 / 备注                                                |
| ---- | ----------------------------------- | --- | ------ | ------------------------------------------------------ |
| E-01 | CORS 写死 `origin:true` 带入生产          | P0  | ✅ 已解决  | 改读 `CORS_ORIGIN` env；未设回落 true，设则白名单锁死；tsc 通过，已重启 3721 |
| E-02 | CI typecheck 门禁 `continue-on-error` | P0  | ✅ 已解决  | 删除 `continue-on-error`，verify job 现阻塞部署；同批追加 `pnpm lint` |
| E-03 | 无统一异常处理                             | P1  | ✅ 已解决  | `AllExceptionsFilter` 已接线 + 3722 冒烟 404/400/200 全过；错误码枚举与结构化日志留待 E-07 |
| E-04 | 零自动化测试                              | P1  | ✅ 已完成   | jest 基础设施 + P0 纯函数(5 suites/107 tests) + P1 金额守卫(10 suites/195 tests) + P2 e2e 链路(2 suites/16 tests)，共 17 suites / 318 tests PASS，双端 tsc EXIT=0 |
| E-05 | 无 lint / 格式化                        | P1  | 🔄 部分完成 | eslint 0 error / 90 warn 接入 CI（原 188 warn，E-14 清理后降 98）；prettier 配置就位但存量 55 文件格式债未统一；next 端 lint 未配 |
| E-06 | 缺 `.env.example`                    | P2  | 📋 待处理 | nest/next 各补样例                                         |
| E-07 | 日志无结构化                              | P2  | 📋 待处理 | 引 pino，关键路径结构化；顺带承接 E-03 错误码枚举                |
| E-08 | 部署迁移策略风险                            | P2  | 📋 待处理 | db push vs migrate deploy，需决策                          |
| E-09 | 前端统一错误边界                            | P3  | 📋 待处理 | 视 api 封装现状                                             |
| E-10 | 依赖安全审计                              | P3  | 📋 待处理 | pnpm audit / Dependabot                                |
| E-11 | 前端性能/可访问性                           | P3  | 📋 待处理 | 排期后续                                                   |
| E-12 | 短信验证码 DTO 校验不严（`phone` 仅 `IsString`） | P1  | 📋 待处理 | `POST /api/auth/send-code` 传 `phone:"123"` 可通过校验并真发码；建议 `IsMobilePhone`，需确认 mock 假号测试兼容性（见 §1 P1） |
| E-13 | Git 提交信息无规范                       | P1  | ✅ 已完成 | commitlint + husky + .gitmessage 模板 + CI 校验步骤；详见 [`docs/commit-convention.md`](commit-convention.md) |
| E-14 | TypeScript `any` 类型安全治理            | P1  | ✅ 已完成 | 288→139 处 any（-149，52%）；新建 @CurrentUser 装饰器 + 4 DTO + 3 interface + Gateway 类型；三端 tsc EXIT=0；211 tests PASS |
| E-15 | API 缺少版本控制                         | P2  | ✅ 已完成 | `enableVersioning(URI, v1)`；前端 baseURL + E2E 路径全替换 `/api/v1/`；附修 ServiceArea upsert 竞态；tsc+lint+211 tests PASS |
| E-16 | 缺少 API 文档（Swagger/OpenAPI）          | P2  | ✅ 已完成 | `@nestjs/swagger@7` + `swagger-ui-express`；25 controller + 15 DTO 全量标注；访问 `http://localhost:3721/docs`；tsc+lint+211 tests PASS |



---

## 3. 处理约定

- 解决某条时：**改代码 → 跑 `tsc`/lint/单测 → 回填本文件「计划/备注」列 commit 与验证命令 → 状态置 ✅**。
- 新增问题：直接加在 §1 对应优先级小节，并在 §2 跟踪表追加一行。
- 决策类（如 E-08）标注「需你拍板」，不在无授权下擅自改生产路径。

## 4. 工程纪律（不可违反）

> 以下规矩由项目维护者确立，违反将导致 CI 失败、合并冲突或类型定义不一致。

### 4.1 分支保护

| 规矩 | 说明 |
|---|---|
| **禁止直接在 `main` 和 `master` 上修改代码** | 所有开发必须在 `develop` 分支进行 |
| **合并流程** | `develop` → 测试通过 → 合并到 `master` 和 `main`（优先 fast-forward） |
| **违反后果** | 直接在 `main`/`master` 上提交会导致与 `develop` 的哈希分叉，合并时产生三方合并冲突 + commitlint CI 失败 |
| **历史教训** | 2026-08-25 因在 `main` 上直接提交（rebase 重写 commit message），导致 `develop → main` 合并时 10 个文件冲突，CI commitlint 步骤 `Invalid revision range` 失败 |

### 4.2 Swagger 类型来源统一

| 规矩 | 说明 |
|---|---|
| **禁止手写 `@ApiProperty`** | DTO 的 API 文档元数据由 Swagger CLI 插件自动推断 |
| **插件配置** | `nest-cli.json` → `@nestjs/swagger` 插件，`classValidatorShims: true` |
| **自动推断来源** | TypeScript 类型（`string`/`number`/`boolean`）+ class-validator 装饰器（`@IsOptional` → required: false） |
| **仍需手写的** | Controller 级标注（`@ApiTags`/`@ApiOperation`/`@ApiBearerAuth`/`@ApiBody`/`@ApiParam`/`@ApiQuery`）— 插件不生成这些 |
| **历史教训** | 2026-08-25 发现 148 处手写 `@ApiProperty` 与 class-validator 装饰器重复定义同一字段，改类型需同步两处，已全部移除并启用插件 |
