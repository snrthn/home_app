# 变更记录

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added — 可观测性
- 后端 Sentry 错误追踪（`@sentry/node`），`SENTRY_DSN` 存在时自动初始化，500+ 异常自动上报
- Prometheus 指标端点 `GET /api/v1/metrics`，采集 HTTP 请求计数/响应时间 + Node.js 默认指标
- PM2 日志轮转配置脚本 `scripts/setup-pm2.sh`（50M 轮转/保留 14 份/gzip 压缩）

### Added — 生产安全
- 健康检查端点 `GET /api/v1/health/live` + `GET /api/v1/health/ready`（数据库连通性检测）
- 数据库自动备份脚本 `scripts/backup-db.sh`（mysqldump 热备 + gzip + 30 天保留）
- GitHub 分支保护 workflow（禁止 force push / 删除分支 / 要求线性历史）
- Dependabot 依赖漏洞扫描（每周一检查 npm + GitHub Actions 版本）
- CI 安全扫描 `pnpm audit --audit-level=high`

### Added — 架构演进
- 优雅停机：`app.enableShutdownHooks()`，PM2 reload 时 WebSocket 平滑断开
- 密钥管理：商户支付配置从 JSON 文件迁移到 DB（`MerchantConfig` 表），消除敏感文件落盘风险

### Added — 工程规范
- `nest/.env.example` 环境变量模板
- Jest 覆盖率收集 + CI 门禁阈值（statements 30% / branches 20%）
- E2E 登录流程测试 + 订单取消流程测试

### Added — 用户体验
- 管理端 headerBar 双击全屏切换
- 退出登录自动解除全屏（三端生效）
- 登录页密码输入框明隐切换（小眼睛图标）
- 根路径按权重自动跳转（用户端 > 师傅端 > 管理端）
- 401 被踢时管理端自动定位到管理员登录 tab

### Added — P2 竞态防护与安全加固
- 师傅审核乐观锁：`approve()` / `setStatus()` 改用 `updateMany` + `where` 条件原子更新，防止并发重复审核
- 订单号防重复：`genOrderNo()` 改用 `randomUUID()` 替代 `Math.random()`，碰撞概率趋近零
- SMS per-phone 限流：同一手机号 60 秒内不可重复发送验证码
- SMS 验证码 DB 存储：real 模式验证码写入 `SmsCode` 表，支持多实例部署（mock 模式仍用内存）
- 登录失败锁定：连续 5 次密码错误锁定 15 分钟，登录成功自动清零
- 未通过审核师傅不可接单：`GET /orders/pool` 和 `POST /orders/:id/grab` 增加 `master.status === 'active'` 校验
- 新增 21 个单元测试（masters 6 + auth 9 + orders 6），全量 233 通过

### Added — P3 事务原子性加固与余额对账
- `transition()` 接受可选 `tx` 参数，支持在 `$transaction` 内执行乐观锁 + 状态流转 + orderLog
- `confirm()` 包 `$transaction`：验收状态流转 + 结算创建原子化，结算失败状态回滚，消除"已验收但无结算"
- `applyPaid()` 走 `transition()` 统一状态机入口 + `$transaction`：支付状态更新与订单状态流转原子化，补审计日志
- `refund()` 第三方退款后 DB 操作包 `$transaction`：状态流转(Refunding→Refunded) + payment 标记 + 补偿单创建原子化，失败可重试
- `grab()` / `assign()` 占位 + 流转包 `$transaction`：masterId 占位与 status 流转原子化，流转失败占位回滚，消除孤儿单
- `releaseToMaster()` / `createCompensation()` P2002 catch + `masterId` null 守卫
- `reconcile()` 余额一致性对账巡检：每 6 小时自动检测孤儿订单/不一致结算/负余额；管理端手动触发 `GET /settlements/reconcile`
- 新增 14 个单元测试（settlements 5 + payments 4 + orders 5），全量 247 通过

### Fixed
- 生产环境 socket 推送失效（`NEXT_PUBLIC_API_BASE` 加 `/v1` 后正则未同步，socket.io 连到错误 namespace）
- 师傅端接单池 WebSocket 推送失效（`join-pool` / `subscribe-order` 未在 `connect` 回调中重新订阅，断线重连后收不到推送）
- 师傅端接单池地域匹配不一致（API 过滤用所在地+接单范围，WS join-pool 仅用接单范围，导致所在地订单推送收不到）
- 生产环境配置真实支付通道后模拟支付不触发新单推送（`mockNotify` 误走真实通道校验）
- 下单成功后返回路径包含已失效的下单页（`router.push` 改为 `router.replace`）
- 运营平台 Tab 切换产生历史栈（`<Link>` 添加 `replace` 属性）
- Tab 页 headerBar 误显示返回按钮（移除 Tab 页的 `showBack` / `backHref`）

### Changed
- 下单成功跳转从 `router.push` 改为 `router.replace`，避免返回时回到已失效下单页
- Tab 切换从 `push` 改为 `replace`，避免历史栈累积
- Nginx WebSocket 代理补全 `Host` / `X-Real-IP` 头并使用 `$connection_upgrade` 变量
- 作者署名补全到所有 `package.json` 和 `LICENSE`

## [0.0.1] - 2026-08-20

### Added
- 家电维修服务平台初始版本
- 三端应用：用户端（客户）、师傅端、运营管理端
- 后端：NestJS + Prisma + MySQL + Socket.io
- 前端：Next.js App Router
- Docker 生产环境配置（Nginx 反向代理 + WebSocket 支持）
- GitHub Actions CI/CD 自动部署流水线
- JWT 认证 + RBAC 细粒度权限
- 订单全流程：下单→支付→接单→履约→验收→结算
- 评价系统、公告通知、协议管理、工单 SLA
