# 老马家电 (home_app) — 项目交接文档

> **交接日期**：2026-08-19  
> **维护者**：AI Agent「巴比」  
> **用户称呼**：虎哥  
> **目的**：下一个 Agent 接手时，从本文件出发即可快速了解项目全貌、工程纪律、当前进度和已知坑。

---

## 0. 快速上手清单

| 事项 | 内容 |
|---|---|
| 工程根 | `D:\FrontEnd\home_app`（monorepo: `nest/` + `next/` + `shared/`） |
| 技术栈 | NestJS + Next.js(App Router) + Prisma + MySQL + pnpm + Turborepo |
| 用户开发端口 | 后端 3721 / 前端 3824（**AI 绝不起/kill**） |
| AI 调试端口 | 后端 3722（跑完必退）；前端不可另起（`.next` 共享目录冲突 → ChunkLoadError） |
| MySQL | 端口 3306，库 `laoma_jiadian`，root 空密码 |
| 前端验证 | 直接 Playwright 打用户已运行的 3824（自己不起 next dev） |
| 后端验证 | `PORT=3722` 起临时实例，跑完 netstat 确认端口释放 |

---

## 1. 关联文件索引（全部记忆与规则来源）

### 1.1 项目记忆文件（WorkBuddy 托管）

| 文件 | 作用 | 路径 |
|---|---|---|
| **项目长期记忆** | 工程纪律、Prisma 坑、UI 规矩、状态机、模块速查、下一步 | `C:\Users\yhnce\WorkBuddy\2026-08-06-09-48-07\.workbuddy\memory\MEMORY.md` |
| **每日工作日志** | 按日记录做了什么、踩了什么坑、做了什么决策 | `…\.workbuddy\memory\YYYY-MM-DD.md`（2026-08-06 ~ 08-19） |
| **用户级跨项目记忆** | 协作方式、端口分工、调试方法论、UI 偏好、身份称呼 | `C:\Users\yhnce\.workbuddy\MEMORY.md` |

### 1.2 项目内文档（工程内 docs/）

| 文件 | 作用 | 路径 |
|---|---|---|
| **RBAC 权限设计** | 四实体模型、权限码表、预设岗位角色、实现路线（已实施） | `docs/rbac-design.md` |
| **下单接单 SOP** | 订单状态机、端点清单、业务约束、验收用例 | `docs/orders-sop.md` |
| **投诉/工单设计** | 工单底座+投诉挂件、SLA 升级、Phase 1 已落地（先读其 0.5 实施状态节） | `docs/complaints-tickets-design.md` |
| **退款/售后设计** | 价值分析 + 最小闭环（Refund 表审核流），Phase 1 已落地（先读其实施清单节） | `docs/refund-aftersale-design.md` |
| **智能派单设计** | 价值分析 + candidates 匹配算法 + 派单工作台 + 看板/自动派单，Phase 1/1.5/2 已落地（先读第 0 节） | `docs/dispatch-design.md` |
| **WS 订阅改造方案** | JWT 握手鉴权 + 房间定向（已实施并验证） | `docs/WS_SUBSCRIPTION_PLAN.md` |
| **项目计划** | 品牌定位、技术栈选型、数据库设计、路线图、决策清单（历史快照，支付模型已被后续迭代取代） | `docs/plan.md` |
| **管理员初始化 SQL** | super_admin 种子账号 | `docs/sql/init-admin.sql` |
| **MySQL 修复脚本** | MySQL 服务启动/修复 bat | `docs/shell/fix-mysql-service.bat` |

### 1.3 会话注入的记忆（自动）

每次会话启动时，系统会自动注入：
- 项目 MEMORY.md（上方 1.1 第一条）的**截断版**（超长会被 truncate）
- 用户级 MEMORY.md（上方 1.1 第三条）的**截断版**

> **注意**：MEMORY.md 超长会被截断，关键规矩已在本文件完整收录，但完整原文仍以上方路径为准。

---

## 2. 工程纪律（硬规矩，违反必出问题）

### 2.1 端口纪律

```
用户恒定：后端 3721 + 前端 3824  ← AI 绝不起/kill 这两个端口
AI 调试：  后端 3722（跑完必退）   前端无独立端口（.next 共享目录冲突）
```

- **绝不在 3721/3824 上起自己的服务做验证**
- 前端验证：直接 Playwright 打用户已运行的 3824
- 后端验证：`PORT=3722` 起临时实例

### 2.2 退服标准动作（必做，否则留孤儿进程）

```bash
# 1. 找 LISTEN 的 PID
netstat -ano | findstr ":3722 "
# 2. 杀进程（非管理员可杀自己起的进程）
PowerShell Stop-Process -Id <PID> -Force
# 3. 再 netstat 确认 LISTEN 行消失
```

> `TaskStop` 对 `pnpm dev`(turbo) 只杀父进程，nest/next 子进程变孤儿继续占端口。必须手动 netstat + Stop-Process 收尾。

### 2.3 Prisma Client 坑

- **EPERM 失败**：用户 3721 锁 DLL → `prisma generate` 会清空 `.prisma/client` 但写不回 → nest 编译挂
- **免停机修复**：临时把 generator `output` 改到 `../.prisma-gen-tmp` → `prisma generate`（新目录无锁）→ `cp -r .prisma-gen-tmp/* node_modules/.prisma/client/` → 恢复 schema output → 删临时目录 → 核验 `index.d.ts` 存在且含新字段
- **pnpm 双副本**：`nest/node_modules/@prisma/client` 是符号链接指向 store 旧副本（无新模型），临时脚本须直连 `nest/node_modules/.prisma/client`
- **R-新5**：改 schema/后端逻辑 → 用户必须重启 3721
- **R-新8**：枚举/表改动 → 必 `prisma db push` 同步 MySQL，否则 Data truncated(1265) → 500
- **Address 表行格式 Compact**：行宽限 8126 字节，加列时若用默认 `VARCHAR(191)` 易超限；行政区划 code 最多 6 位，用 `@db.VarChar(12)` 足矣（2026-08-19 加 3 个 code 列踩坑）

### 2.4 Role 枚举值是小写

```typescript
// shared/src/types.ts — 枚举值是小写字符串
Role.Admin   = 'admin'    // 不是 'Admin'
Role.Master  = 'master'
Role.Customer = 'customer'
```

手写测试 JWT 时 role 必须写小写 `'admin'`，大写会 403。PermGuard 需 payload 带 `perms: string[]`。

---

## 3. 前端 UI 通用规矩（11 条，编号稳定）

| # | 规矩 |
|---|---|
| 1 | 弹窗不点遮罩关闭（`.modal-overlay` 禁挂 onClick） |
| 2 | 行内操作统一 `btn-link`，危险 `btn-link btn-link-danger`；页头「+新增」`btn-primary`（右对齐 `marginLeft:auto`） |
| 3 | 操作列固定宽：单按钮 90px / 双按钮 130px / 三按钮水平一行 180px（纵向堆叠已被否——用户要求水平布局；2026-08-21 工单/投诉页实测） |
| 4 | 列宽标尺：主名称 220+ 起；短列 70-80；价格 110；长文本不设宽 + `.cell-ellipsis` |
| 5 | 弹窗用 `Modal.tsx`（`closeOnOverlay` 默认 false、`showClose` 默认 true）；宽度 480/600/760 |
| 6 | headerBar 返回 `onBack=router.back()` 优先、`backHref` 仅兜底（防跳错） |
| 7 | PC 宽屏适配：用户/师傅端 `.order-mod`+`.order-grid`；管理端 `.admin-detail-page`+`.admin-detail-grid` |
| 8 | 空数据统一 `<EmptyState text="..." />` |
| 9 | 列表行底色/hover 走 `:root` 令牌（`--row-bg` 等），禁止硬编码；卡片容器由 `.data-table-wrap` 统一承载 |
| 10 | 订单状态切换一律二次确认（`ConfirmDialog` 再调 API，禁止 onClick 直发） |
| 11 | 取消按钮走白名单 `CANCELABLE.includes(status)`；退款取消文案前置"资金状态以平台为准"；状态说明归集到订单信息卡备注下方「流转状态」区块（标红 `var(--color-danger)`） |

---

## 4. 时间显示金标准

- **统一用 `formatDateTime(x)`**（`next/src/lib/format.ts`），纯前端零迁移
- ❌ **禁止** `.slice(0,16).replace('T',' ')`（丢弃 Z，把 UTC 当本地，少 8 小时）
- 例外：生日/预约日期 `.slice(0,10)`；`notices` startAt/endAt `.slice(0,16)`（datetime-local 输入值需无时区）

---

## 5. 订单状态机

```
pending_payment → pending_accept → accepted → departing → arrived → servicing → pending_confirm → reviewed → evaluated
                                                                                                    ↑
                                                      confirm(客户验收) → 释放托管金 → settlements 生成
取消(支付后): → Refunding → Refunded (阶梯退款: departing 80%退 / arrived 50%退 / 其余全额)
取消(支付前): → Cancelled (无退款, 终态)
```

- 取消原因必填落 `Order.cancelReason`（VarChar 200，1-200 字）
- 到达验证码 `Order.arriveCode`（客户生成 6 位码 / 师傅校验 / 一次性消费）
- 资金释放唯一入口：`confirm()`（验收），评价不再自行改订单状态

---

## 6. 规矩 R-新1~8（全局约束编号）

| 编号 | 内容 |
|---|---|
| R-新1 | 枚举定全（状态/支付/结算等所有枚举在 shared 定义） |
| R-新2 | 权限码稳定（改名同步 function-points + DB + @RequirePerm + 前端 menu） |
| R-新3 | 级联删除保护（软删 deletedAt，不物理删） |
| R-新4 | 价格快照隔离（下单写 Order.serviceSnapshot + Order.commissionSnapshot） |
| R-新5 | 改 schema/后端必重启 3721 |
| R-新6 | Prisma _count 含软删表带 `where:{deletedAt:null}` |
| R-新7 | 工种类型轴已移除（改树形一级类目） |
| R-新8 | 枚举/表改动必 `prisma db push` 同步 MySQL |

---

## 7. 关键模块速查

### 7.1 后端模块（nest/src/）

| 模块 | 路径 | 要点 |
|---|---|---|
| auth | `nest/src/auth/` | JWT(access+refresh) + bcrypt；手机号验证码 + 管理员账密 |
| orders | `nest/src/orders/` | 状态机 transition() + canTransition 校；create 写快照；confirm 释放金 |
| payments | `nest/src/payments/` | Provider 接缝(mock/wechat/alipay)；AES-256-GCM 加密落 `config/merchant.json` |
| settlements | `nest/src/settlements/` | 余额实时聚合(无冗余字段)；releaseToMaster 幂等 |
| withdrawals | `nest/src/withdrawals/` | pending(冻结)/paid/rejected(解冻)；乐观锁防超提 |
| commission | `nest/src/commission/` | 三级降级解析(service→category→global)；区间断点 resolveTierRatio |
| reviews | `nest/src/reviews/` | 一单一评(orderId unique)；评价成功自动 Reviewed→Evaluated+重算师傅评分 |
| rbac | `nest/src/rbac/` | StaffRole + Permission + PermissionGuard(@RequirePerm) |
| gateway | `nest/src/gateway/` | socket.io /ws；**按订阅改造**：JWT 握手鉴权 + 房间定向 `order:<id>`/`pool` + `broadcastPoolUpdate` 补推（详见第 9 节） |
| users | `nest/src/users/` | 三角色(admin/master/customer) CRUD |
| services | `nest/src/services/` | 类目树(parentId) + 服务项(price/unit) + 区域(deletedAt×isActive) |
| masters | `nest/src/masters/` | 接单范围 serviceAreas(Json) + 技能 skills(Json)；`updateMe` 白名单校验（详见第 10 节） |
| common | `nest/src/common/` | `region-match.ts`：`regionMatches`(code-only) + `serviceAreasToRules` 转换器（详见第 10 节） |
| reports | `nest/src/reports/` | 运营报表：dashboard 工作台 5 指标 + business/performance/growth 三报表（时间分桶、口径见第 12 节） |
| tickets | `nest/src/tickets/` | 工单底座 + 投诉挂件（详见第 18 节）：Ticket/Complaint/TicketComment、SLA setInterval 升级、`tickets-pool` WS |
| audit | `nest/src/audit/` | @Audit 装饰器写操作日志 |

### 7.2 前端关键文件（next/src/）

| 文件 | 作用 |
|---|---|
| `lib/admin-menu.ts` | 管理端菜单（唯一来源，含 perm 过滤） |
| `lib/admin-api.ts` | 管理端 API 调用（服务项/类目/区域/支付配置/师傅） |
| `lib/orders-api.ts` | 订单/结算/提现/分账 API 调用 |
| `lib/api.ts` | axios 实例 + 拦截器（支持 `NEXT_PUBLIC_API_BASE` 覆盖） |
| `lib/format.ts` | `formatDateTime()` 时间格式化（金标准） |
| `lib/order-status.ts` | 前端状态流转辅助 |
| `lib/query-keys.ts` | React Query key 常量 |
| `components/Modal.tsx` | 弹窗组件（closeOnOverlay=false 默认） |
| `components/ConfirmDialog.tsx` | 二次确认弹窗 |
| `components/admin/DataTable.tsx` | 通用表格（Column 类型） |
| `components/EmptyState.tsx` | 空数据占位 |
| `components/CopyText.tsx` | CopyButton（一键复制，防父级跳转） |
| `components/admin/ReportCharts.tsx` | 纯 SVG 报表图表（GroupedBarChart/MultiLineChart，ECharts 风格 tooltip + axisPointer 竖线，图例 HTML 渲染） |
| `components/admin/DateRangeFilter.tsx` | 报表页日期筛选（开始/结束 + 查询/清除，start/end 透传后端） |
| `lib/useOrderSocket.ts` | WS 订阅 hook（订单详情/接单池/`onDashboardRefresh` 工作台刷新回调） |
| `lib/tickets-api.ts` | 投诉/工单 API 封装（提交/列表/详情/留言/改派/流转/处置） |
| `components/admin/Ticket*.tsx` | TicketDetail（只读详情）/ TicketProcess（处理·结案）/ TicketAssign（改派）三独立弹窗，确认按钮一律走 Modal `footer`（`.modal-actions`） |
| `components/StickyTabs.tsx` | 吸顶 Tab（订单列表状态分类筛选；超宽右滑 + 右侧渐隐箭头指引） |
| `components/form/Field.tsx` | 表单项组件（label 上/控件下，`.field` 底距 16px；Field 内 `.select` 宽度 100%） |

### 7.3 Shared 类型定义

| 文件 | 内容 |
|---|---|
| `shared/src/types.ts` | OrderStatus 枚举(L9)、PaymentStatus 枚举(L24)、ORDER_STATUS_FLOW(L73)、Role 枚举(小写值) |

---

## 8. 分账规则引擎（2026-08-19 落地）

- **数据模型**：`CommissionRule`(scope+refId 唯一, platformRate Decimal(5,4), refundPolicy(full/tiered/keep_commission), refundTiers Json, isActive, note)
- **三级降级**：`resolve(serviceItemId)` → service 规则 → category 规则(沿 parentId 向上) → global 规则，取首个 active
- **订单快照**：下单时调 `resolve()` 写入 `Order.commissionSnapshot`，退款/结算全程读快照
- **区间断点**：`resolveTierRatio(status, tiers)` 沿 `CANCELLABLE_LIFECYCLE` 向前找最近断点（语义"from status onward"）
- **管理端**：`/admin/finance/commission`（perm `finance:manage`；全局规则禁删只许改）
- **当前库里**：仅一条全局默认（0% + tiered + departing 80% / arrived 50%），与改造前行为完全一致
- ⚠️ 行为变更：默认配置下 `servicing`/`pending_confirm` 退款比例从旧 100% 变为继承 `arrived` 50%（如需全额退可显式加断点）

---

## 9. WS 推送按订阅改造（2026-08-19 落地）

> 方案文档：`docs/WS_SUBSCRIPTION_PLAN.md`（已标注「已实施并验证」）

- **鉴权**：`orders.gateway.ts` `afterInit` 加握手中间件，连接必须带合法 JWT（复用 `JwtService` + `JWT_ACCESS_SECRET` + `isBlacklisted`），无 token/过期/拉黑一律 `next(new Error('unauthorized'))`
- **房间定向**：`server.emit`（全端群发）改为 `to('pool')`（接单池，仅师傅）/ `to('order:<id>')`（订单详情订阅者）；`join-pool` 后端校验 `role==='master'`
- **池子补推**：`transition()` 中 `order.status===PendingAccept && to!==PendingAccept` 时调 `broadcastPoolUpdate`，解决接单后别人池子不刷新
- **前端**：`useOrderSocket` 连接带 `auth.token`，三个消费页分别传 `{orderId}` / `{pool:true}`
- **验证**：鉴权（无 token/假 token 被拒）+ 房间隔离（master 收 new-order、customer 收 order:A、customer join-pool 被拦）两类 PASS
- **坑**：`jsonwebtoken` 在 pnpm 隔离下不可直接 import，改用 `JwtService` + `GatewayModule` 的 `JwtModule.registerAsync`

---

## 10. 服务区域地域匹配体系（2026-08-19 ~ 08-20 落地）

### 15.1 三个「区域」概念
| 概念 | 存储 | 性质 |
|---|---|---|
| `ServiceArea` 表 | DB 独立表 | 平台开通字典（admin 勾选树） |
| `Master.serviceAreas` | Master JSON 字段 | 师傅接单范围（多值数组） |
| `Master` 所在地 6 段 | Master 字段 | 师傅常驻地址（单值） |
| `Notice.targetRegions` | Notice JSON 字段 | 公告投放范围 |

### 15.2 公共匹配规则（`common/region-match.ts`）
- `regionMatches(targetRegions, region)`：code-only 匹配（**撤掉名称兜底**，避免「市辖区」跨城市同名误匹配）；province 必中、city/district 缺级通配、任一规则全级命中即 true；空规则集返回 true（严格语义由调用方处理）
- `serviceAreasToRules(areas)`：把 ServiceArea 表记录按 level 映射成规则集（level=1 通配全省 / level=2 通配全市 / level=3 精确到区）；调用方先过滤 `isActive=true && deletedAt=null`
- `masterCoversOrder(master, addr)`（`orders.service.ts` 私有方法）：师傅「所在地 ∪ 接单范围」并集判定，pool/grab 共用

### 15.3 已接线的业务场景
| 场景 | 实现 | 状态 |
|---|---|---|
| 下单 `create()` 校验地址在开通区域 | 查已开通区域 → `regionMatches(rules, addr)` false 则 throw「该区域暂未开通服务」 | ✅ P0 |
| 接单池 `pool()` 按「所在地 ∪ 接单范围」过滤 | `masterCoversOrder(master, addr)` | ✅ |
| 抢单 `grab()` 二次校验师傅覆盖订单 | `masterCoversOrder` false 则 throw「您不在该订单的服务区域」 | ✅ P1 |
| 师傅配置 `updateMe()` 白名单约束 | 所在地 + 接单范围每条都校验落在已开通区域内 | ✅ P1 |
| 公告可见性 `getPublicList()` | 按 targetRegions 过滤（所在地 ∪ serviceAreas） | ✅（早就接） |
| Address 表 code 字段 | provinceCode/cityCode/districtCode @db.VarChar(12) | ✅ |
| 所在地入口统一到 accept-settings | edit 页移除所在地 Field，accept-settings 加 RegionCascader 单值 | ✅ |

### 15.4 未接线（剩余 Gap）
| 优先级 | 场景 | 说明 |
|---|---|---|
| P2 | WS `broadcastNewOrder` 按区域过滤 | 当前推给 pool 房间全部师傅（含地址），需握手缓存 regions + 广播遍历过滤 |
| P3 | admin 师傅管理加 serviceAreas 审计列 | 纯展示 |
| P3 | `assign()` 管理员指派区域校验 | 虎哥 2026-08-20 决策暂不加 |

### 15.5 关键设计决策
- **并集语义（∪）**：师傅接单池可见性 = 所在地 ∪ 接单范围（与公告过滤语义一致）；两者皆空才看不到任何单
- **code-only 匹配**：撤掉名称兜底（虎哥决策：风险大于成本——同名不同域如「市辖区」跨城市误匹配）
- **严格不可见**：师傅未配任何区域 → 接单池返回 `[]`（不是全平台可见）
- **数据统一**：所有地址入口用同一个 `@/data/region` + `RegionCascader`，6 段严格保存，code 永远有值

---

## 11. 退款明细三端展示修复（2026-08-19 落地）

- **根因**：退款额 `refundAmount` 算出后未落库，三端共用补偿结算单的 `masterAmount`（师傅补偿额）当「退款补偿」展示 → 用户端看到 32 元（实应 128 元）
- **修复**：后端 `byOrder()` 反推 `refundAmount = orderAmount − platformFee − masterAmount` 返回；前端三端区分展示
  - 用户端：退款金额（品牌蓝，全额退款也显示）
  - 师傅端：退款补偿（品牌蓝）+ 本单收入（绿色，互斥展示）+ 退款审核人/时间拆行
  - 管理端：退款明细（三方份额：用户退款/平台留成/师傅补偿，平台留成 ¥0 也体现）
- **全额退款兜底**：`refundRatio=1 → masterCompensation=0 → 不生成补偿单`，前端渲染条件改为 `compensation || order.status==='refunded'`，金额取 `Number(compensation?.refundAmount ?? order.amount)`
- **实时刷新**：`master/[id]` 的 `refresh()` 补 `invalidate(['settlementsByOrder', id])`，取消后退款补偿金额实时更新

---

## 12. 运营平台工作台与数据报表（2026-08-20 落地）

### 12.1 工作台 Dashboard（`/admin`）

- **5 个指标卡**：今日订单（已支付口径）、待处理订单（pending_accept 数）、在线师傅、本月 GMV、本月平台净收入
- **实时刷新链路**：业务事件（新单/订单更新/池子更新/登出）→ `orders.gateway.ts` `notifyDashboardRefresh()` emit `dashboard-refresh` 到 `admin-dashboard` 房间 → 前端 `useOrderSocket({ onDashboardRefresh })` → `invalidateQueries(['dashboard'])` → React Query 重拉
- ⚠️ **在线师傅 = lastActiveAt 5 分钟窗口，不是 WS 连接**（虎哥实测反馈驱动：只有切到接单页的师傅才有 WS 连接，不代表登录在线）。判定：`User.lastActiveAt >= now-5min && role==='master'`
- **心跳机制**：`auth` 新增 `POST /auth/heartbeat`；前端 `PortalShell` 对 `role==='master'` 挂载立即调 + `setInterval` 每 2 分钟一次；`issueTokens()` 登录时更新 lastActiveAt，`logoutFromHeader()` 登出清空
- **口径**：GMV = 已支付订单金额（`Payment.paidAt` 当月），平台净收入 = 平台留成合计（含补偿单），今日订单按 `Payment.paidAt` 今天

### 12.2 数据报表（`/admin/reports/*`）

| 页面 | 路由 | 后端接口 | 内容 |
|---|---|---|---|
| 经营报表 | `/admin/reports/business` | `GET /reports/business?dimension=&start=&end=` | 营收/订单量趋势图 + 明细表（按日/周/月分桶，最近 30 桶） |
| 师傅绩效 | `/admin/reports/performance` | `GET /reports/performance?sort=&limit=&start=&end=` | 收入/订单/评分/完成率 4 种排序，Top10 收入图 + 排名表 |
| 用户增长 | `/admin/reports/growth` | `GET /reports/growth?dimension=&start=&end=` | 新客户/新师傅/新订单趋势 + 注册→首单转化漏斗 |

- **统一口径**（后端 `reports.service.ts` 注释同步）：
  - 营收/订单量按**支付时间** `Payment.paidAt` 归桶；订单量按 orderId 去重
  - 退款单数/金额按补偿结算单 `settledAt`（近似退款时间），金额 = orderAmount − platformFee − masterAmount 反推
  - 完成订单 = status ∈ {reviewed, evaluated}（按 createdAt 归桶）；完成率 = 完成 ÷ 创建
  - `PAID_STATUSES` = paid/confirmed/completed/reviewed/evaluated/refunding（排除 PendingPayment/Cancelled/Refunded）
- **图表组件** `ReportCharts.tsx`：纯 SVG（viewBox 1000×200，5:1 自适应容器宽度）；图例 HTML 渲染在标题下方；自定义 ECharts 风格 tooltip（深色圆角面板 + 系列色点 + axisPointer 虚线竖线，`useChartTip` hook 换算 viewBox 坐标反推索引）；坐标轴 label 字号 9（SVG 等比放大后视觉 ≈ 14px）
- **日期筛选**：三页均有 `DateRangeFilter`，格式 `YYYY-MM-DDT00:00:00` / `YYYY-MM-DDT23:59:59`（本地时区含整天），不传则走后端默认范围（近 30 桶/全历史）
- **已发现缺口**：`lastActiveAt` 从 2026-08-20 才开始维护，历史在线数据无留存；`Order.refundedAt` 缺失（用 settlement.settledAt 近似）；均不影响当前展示

---

## 13. 当前完成状态（截至 2026-08-23）

### 已完成 ✅

- [x] Phase 0 脚手架 + 库表 + JWT + 三端 layout
- [x] RBAC 四实体 + PermissionGuard + 7 预设岗位角色
- [x] 支付前置 + 平台担保托管模型（订单状态机改造）
- [x] PaymentProvider 接缝（mock/wechat/alipay 可切换）
- [x] 前端三端订单全链路（下单/列表/详情/支付/取消/验收/评价）
- [x] 师傅抢单并发防（updateMany 乐观锁）
- [x] 到达验证码（客户生成 / 师傅校验 / 一次性）
- [x] 阶梯退款全链路（departing 80% / arrived 50%）
- [x] 退款两段式走状态机（Refunding→Refunded 均经 `orders.transition()`，统一写 orderLog + 实时广播；不再直接 order.update 绕过）
- [x] 评价模块（5 星 + 200 字 + 匿名，一单一评）
- [x] 收入/提现模块（余额实时聚合 + 管理端审核）
- [x] 分账规则引擎全链路（CommissionRule + 快照 + 三方分账 + 管理端配置页）
- [x] WS 实时推送按订阅改造（JWT 握手鉴权 + 房间定向 `order:<id>`/`pool` + `broadcastPoolUpdate` 补推；鉴权与房间隔离两类验证 PASS，详见第 9 节）
- [x] 退款明细三端展示修复（用户端退款金额/师傅端退款补偿+本单收入/管理端退款明细三方份额；全额退款兜底；语义化配色区分；审核人/时间拆行）
- [x] 接单池卡片补「下单时间」
- [x] 退款补偿金额实时刷新（master/[id] refresh() 补 invalidate settlementsByOrder）
- [x] Address 表补 code 字段（provinceCode/cityCode/districtCode @db.VarChar(12)）+ 全链路 code-first 匹配
- [x] 服务区域地域匹配体系 P0+P1（详见第 10 节）：下单校验开通区域、抢单二次校验、师傅配置白名单约束
- [x] 师傅端地域影响改为「所在地 ∪ 接单范围」并集语义 + 所在地入口统一到 accept-settings
- [x] regionMatches 撤掉名称兜底（code-only，避免「市辖区」跨城市同名误匹配）
- [x] 时间显示全量统一为 formatDateTime
- [x] 登录页双击全屏修复
- [x] 订单号一键复制（CopyButton 组件）
- [x] 状态切换一律二次确认（ConfirmDialog）
- [x] 取消白名单 + 流转状态红字区块（含未支付取消文案区分）
- [x] UI 11 条规矩全量落地
- [x] 运营平台工作台（5 指标卡 + WS 实时刷新 + lastActiveAt 在线判定 + 师傅端心跳，详见第 12.1 节）
- [x] 数据报表模块（经营/绩效/增长三页 + 4 个后端接口 + 时间分桶，详见第 12.2 节）
- [x] 报表图表组件优化（SVG 自适应容器宽度、HTML 图例、ECharts 风格 tooltip + axisPointer、Y 轴方向修正）
- [x] 三页报表日期筛选（DateRangeFilter，start/end 全链路透传）
- [x] 投诉/工单模块 Phase 1（详见第 18 节）：后端 tickets 模块 + SLA 升级 + 权限种子 + 迁移 SQL + 管理端两页（三弹窗解耦）+ 客户端「我的投诉」独立页与投诉记录页
- [x] 管理端工单/投诉页交互规范化（操作列三按钮水平一行 180px；详情/处理/改派三独立弹窗，确认按钮走 Modal FooterBar；表单项用 Field 组件、下拉宽度 100%）
- [x] 客户端/师傅端订单列表吸顶 Tab 分类筛选（StickyTabs，按两端业务性质拆分类别，超宽右滑 + 右侧渐隐箭头指引）
- [x] 师傅端首页从占位改为正式布局（欢迎卡 + 4 格统计 + 可提现收入卡 + 进行中订单待办，WS 实时刷新）
- [x] 退款/售后模块 Phase 1（详见第 19 节）：Refund 表审核流（投诉处置退款建单 → 通过/驳回）+ 3 后端端点 + shared 状态机放行已完单退款（Reviewed/Evaluated→Refunding）+ 管理端 `/admin/orders/refund` 台账页（通过/驳回 Modal FooterBar）+ 工单处理/详情弹窗联动提示
- [x] filter-bar 控件尺寸统一（`.filter-bar .input` 与 `.select`/`.btn-ghost` 同高 34px/14px，globals.css 已沉淀）
- [x] 智能派单模块 Phase 1（详见第 20 节）：candidates 推荐查询（区域硬过滤 + 技能软加分 + 负载排序）+ 派单工作台 `/admin/dispatch/smart`（左右分栏 + 一键指派 + 全量兜底）+ 移除冗余抢单池页面/权限码/菜单
- [x] 智能派单 Phase 1.5（推荐质量升级）：祖先链技能匹配（父类目覆盖子类目订单，前端「父类目覆盖」徽章）+ 预约时间冲突检测（同日 slot 重叠降权不排除，前端橙色「时段冲突」标签）
- [x] 智能派单 Phase 2 看板 + 自动派单（详见第 20 节）：`GET /orders/dispatch/stats` 看板统计（待派/超时/在岗/今日已派/平均接单时长）+ `DispatchSchedulerService` 超时自动派单（推荐第一名，`actorId='system'`，预约单豁免，env 可配）+ 工作台接 WS `dashboard-refresh` 实时刷新 + 超时徽章
- [x] 管理端登录 401 修复（admin passwordHash 空且未绑 super_admin → bcryptjs 补齐）+ updateAdmin UserProfile 嵌套 update 改 upsert（2026-08-23）
- [x] 找回密码全链路（详见第 21 节）：`POST /api/auth/reset-password`（OTP 免旧密码）+ `/forgot-password` 独立页 + 登录页入口 + 路由守卫放行（2026-08-23）
- [x] 短信验证码 mock/real 双模式 + 阿里云真实网关（详见第 21 节）：SystemConfig.smsMode 开关 + 原生 HTTP 阿里云 provider（零 SDK）+ 运营平台配置页网关参数表单（2026-08-23）
- [x] AccessKeySecret 加密存储（详见第 21 节）：AES-256-GCM `enc:v1:` 格式 + API 掩码返回 + `SMS_SECRET_ENCRYPT_KEY`（2026-08-23）

### 待办 / 已知缺口

| 优先级 | 事项 | 说明 |
|---|---|---|
| P1 | **投诉/工单 + 退款审核端到端联调** | ✅ 迁移已应用（2026-08-21 14:00 用户授权后本机 `migrate resolve --applied 20260821000000_add_tickets_module` + `migrate deploy`，14 迁移全绿，工单带 refunds 关联查询实测通过）。**2026-08-21 脚本端到端验证 PASS（`nest/scripts/verify-p1-runtime.cjs` 10/10：投诉→退款审核→阶梯退款入账 refundedAmount=100 + 状态机→evaluated + WS new-order/order-update 推送）**；剩用户重启 3721（加载新 client）+ Playwright 浏览器冒烟 |
| P1 | 浏览器跑通 mock 全流程 | 用户重启 3721 后 Playwright 打 3824 验证 departing/arrived → evaluated + WS |
| P1 | 订单内 IM 聊天 | 独立工程；会话锚点用 `Conversation.orderId`（非手机号 Hash）；验证码切勿走 IM 发送 |
| P2 | 投诉/工单 Phase 2 | 师傅端「我的工单」查看+申诉、工作台「待处理工单」指标卡、SLA 倒计时前端展示（超时标红）（**评估 2026-08-21：4 项 P2 互相独立、无架构改动，可一次批量实现，待虎哥确认开工**） |
| P2 | 投诉入口补全 | 订单详情（reviewed/evaluated）「投诉」按钮 + 评价 1-2 星引导投诉（设计见 complaints-tickets-design.md 第 6 节，均未接）（**评估 2026-08-21：后端 `GET /tickets/mine` 就绪，仅前端 4 处，可随 P2-1 批量实现，待确认**） |
| ~~**P2**~~ ✅ | WS 新单广播按区域过滤 | `orders.gateway.ts` `join-pool` 握手按 `Master.serviceAreas` 加入 `zone:<省>:<市>:<区>` 房间（空段通配）；`broadcastNewOrder`/`broadcastPoolUpdate` 按 `dispatchZones(order)` 定向投递；`verify-ws-zone-e2e.cjs` 9/9 + `verify-zone-match.cjs` 9/9 PASS（2026-08-21） |
| P2 | 客户未生成码兜底 | N 分钟后照片 + GPS 凭证到达 |
| P2 | admin 师傅管理加 serviceAreas 审计列 | 纯展示，让运营能审计师傅接单范围 |
| P3 | 真实支付联调 | 需商户凭证 + 公网回调地址（**暂不处理 · 2026-08-21 虎哥决策**） |
| P3 | 阶梯退款真实渠道验证 | wechat provider refund/total 已分字段（**暂不处理 · 2026-08-21 虎哥决策**） |
| P3 | assign() 管理员指派区域校验 | 暂不加（虎哥 2026-08-20 决策），如需可加「强制指派」开关（整体 P3 **暂不处理 · 2026-08-21 虎哥决策**） |
| P3 | lastActiveAt 历史数据缺失 | 在线数判定字段 2026-08-20 才开始维护，历史在线趋势无法回溯；`Order.refundedAt` 缺失用 settledAt 近似（**暂不处理 · 2026-08-21 虎哥决策**） |
| P2 | **短信真实发送验证** | 运营平台切 real + 填阿里云四参数（AccessKeyId/Secret/SignName/TemplateCode，模板需含 `${code}` 变量）后自验真发信；凭证缺失会返回 400 清晰错误（**2026-08-23 待虎哥填凭证**） |
| P2 | **3721 重启加载新逻辑** | 短信开关/加密/找回密码均需重启 3721 生效（Prisma client dll 曾被锁未重新 generate，重启后自动就绪） |
| P2 | **`SMS_SECRET_ENCRYPT_KEY` 环境同步** | `nest/.env` 已生成（gitignore 保护）；**换库/换环境部署必须同步该 key，否则旧密文解不开**（走明文兜底但 secret 失效） |

---

## 14. 协作方式（跨项目通用，用户级记忆摘要）

- 用户（虎哥）会**自己动手并行操作**——不能假设系统状态只由 AI 改变
- 用户会**回头核查数据并直接质疑**——要可核查的证据链，不是漂亮话
- 用户有管理员权限、愿意自己执行脚本；AI 会话通常非管理员
- 用户否定 AI 结论时，**默认他是对的**，回去查代码，不要复述"复现不了"
- 涉及提权的操作写成独立脚本交给用户跑

---

## 15. 工程结构速览

```
D:\FrontEnd\home_app\
├── nest/                      # NestJS 后端
│   ├── src/
│   │   ├── auth/              # JWT 鉴权
│   │   ├── orders/            # 订单状态机 + CRUD
│   │   ├── payments/          # 支付接缝(mock/wechat/alipay)
│   │   ├── settlements/       # 结算台账
│   │   ├── withdrawals/       # 提现管理
│   │   ├── commission/        # 分账规则引擎
│   │   ├── reviews/           # 评价
│   │   ├── rbac/              # 角色权限
│   │   ├── gateway/           # WebSocket(socket.io /ws)
│   │   ├── users/             # 用户管理
│   │   ├── services/          # 服务类目/项目/区域
│   │   ├── masters/           # 师傅管理
│   │   ├── tickets/           # 投诉/工单（工单底座+投诉挂件，见第 18 节）
│   │   ├── audit/             # 操作日志
│   │   ├── reports/           # 运营报表（工作台 dashboard + 三报表）
│   │   ├── prisma/            # PrismaService
│   │   ├── common/            # 公共装饰器/守卫 + region-match.ts（地域匹配规则集）
│   │   └── config/            # merchant.json(AES加密)
│   ├── prisma/
│   │   └── schema.prisma      # 数据模型(唯一真相源)
│   └── tsconfig.json
├── next/                      # Next.js 前端
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login   # 统一登录页
│   │   │   ├── admin/         # 管理端(/admin/*)
│   │   │   ├── client/        # 客户端(/client/*)
│   │   │   └── master/        # 师傅端(/master/*)
│   │   ├── components/         # 通用组件(Modal/DataTable/ConfirmDialog等)
│   │   └── lib/               # API/格式化/菜单/QueryKeys
│   └── tsconfig.json
├── shared/                    # 三端共享类型
│   └── src/types.ts           # 枚举 + 状态机定义
├── docs/                      # 项目文档(本文件所在地)
│   ├── HANDOFF.md             # ← 你在这里
│   ├── rbac-design.md         # RBAC 权限设计
│   ├── orders-sop.md          # 下单接单流程 SOP
│   ├── plan.md               # 项目计划（历史快照，原 docs/需求文档/ 迁入）
│   ├── sql/init-admin.sql     # 管理员种子
│   └── shell/                 # 运维脚本
├── mysql-data/                # MySQL 数据目录
├── package.json               # pnpm workspace 根
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 16. MySQL 运行方式

本机 MySQL 未注册为服务，用项目内数据目录直接拉进程：

```bash
cd "C:/Program Files/MySQL/MySQL Server 8.0/bin"
./mysqld --datadir="D:/FrontEnd/home_app/mysql-data" \
         --innodb-undo-directory="D:/FrontEnd/home_app/mysql-data" \
         --port=3306 --console
```

库 `laoma_jiadian`，root 空密码。

---

## 17. 常用命令

```bash
# 构建顺序（先 shared 再 backend）
pnpm --filter @laoma/shared build
pnpm --filter @laoma/backend build

# TypeScript 检查
npx tsc --noEmit --project next/tsconfig.json   # 前端
npx tsc --noEmit --project nest/tsconfig.json    # 后端

# Prisma（改 schema 后）
# 免停机：见第 2.3 节
# 正常流程（用户停服后）：
cd nest && npx prisma db push --skip-generate

# 前端启动（用户自己跑）
NEXT_PUBLIC_API_BASE=http://127.0.0.1:3721/api next dev -p 3824

# 后端启动（用户自己跑）
# main.ts 用 process.env.PORT
cd nest && PORT=3721 pnpm start:dev
```

---

## 18. 投诉/工单模块（2026-08-20 设计定稿，08-21 Phase 1 落地）

> 设计文档：`docs/complaints-tickets-design.md`（v1.1，含实施差异清单，**先读其 0.5 节**）

- **架构**：工单底座 + 投诉挂件——`Ticket`（type=consult/complaint/refund/report/system）统一流转，`type=complaint` 时 1:1 挂 `Complaint`（处置结果 refund/compensate/redispatch/no_fault 四选一）
- **后端**：`nest/src/tickets/`（7 端点：建单/列表/详情/留言/改派/流转/投诉处置 + `GET /tickets/mine`）；SLA 定时升级用**原生 setInterval**（`sla.scheduler.ts`，`SLA_SCAN_MS` 可调默认 5min——`@nestjs/schedule` 沙箱装不了）；WS 走 `tickets-pool` 房间推 `ticket-update`
- **投诉门槛**：仅 `order.status ∈ {reviewed, evaluated}` 可提交（决策点 2）
- **前端管理端**：`/admin/reviews/tickets` + `/admin/reviews/complaints`，操作列【详情/处理/改派】三按钮（水平一行 180px）→ 三独立弹窗（`TicketDetail` 只读 / `TicketProcess` 处理·结案 / `TicketAssign` 改派），确认按钮一律走 Modal `footer`
- **前端客户端**：个人中心「我的投诉」→ `/client/complaints`（提交，仅 reviewed/evaluated 订单可选）+ `/client/complaints/history`（记录）
- **⚠️ 迁移与种子（用户本地必做，否则提交投诉 500）**：
  ```bash
  cd nest
  pnpm prisma migrate deploy   # 三表迁移 20260821000000_add_tickets_module（手写 SQL）
  pnpm seed                    # 权限码 complaints:handle/tickets:manage + cs_agent/ops_lead 绑定
  ```
- **坑**：`@prisma/client` re-export 破损 → Prisma 类型走相对路径 `../../node_modules/.prisma/client`；seed.js 用 CommonJS 直连 `.prisma/client`（绕开 pnpm 双副本）
- **未做**：Phase 2（师傅端我的工单/工作台指标卡/SLA 倒计时展示）、订单详情投诉按钮、评价引导投诉、端到端联调

---

## 19. 退款/售后模块（2026-08-21 Phase 1 落地）

> 设计文档：`docs/refund-aftersale-design.md`（v1.1，含价值分层与关键发现，**先读第 3 节**）

- **背景**：退款能力早已闭环（阶梯分账/渠道退款/审计），但运营端无任何「看得见、管得住」退款的页面；菜单「退款/售后」一直是占位 404
- **关键发现**：投诉处置 result=refund 对已完单（reviewed/evaluated）订单会被**双重拦截**（`REFUNDABLE_STATES` 不含完单态 + `ORDER_STATUS_FLOW` 无 refunding 出口）——该退款路径从未真正成功过，本轮顺带修复
- **数据层**：`Refund` 表（RF+yyyyMMdd+4位 单号，status pending_review/approved/rejected，`settlementId @unique` 1:1 关联补偿结算单）+ 手写迁移 `20260821010000_add_refund`
- **状态机**：`shared/src/types.ts` 放行 `Reviewed→Refunding`、`Evaluated→Refunding`（仅 `payments.reviewRefund` 的 allowCompleted 场景可用，取消单直退不受影响）；shared dist 已重建
- **后端**：`payments.service.ts` 新增 `createRefundRequest`/`listRefunds`/`reviewRefund`；`refund()` 增加 `opts.allowCompleted/reason`；`tickets.service.resolveComplaint` result=refund 由「发起即执行」改为「创建退款申请」；3 端点 `GET /payments/refunds`、`POST /payments/refunds/:id/approve|reject`（perm `orders:refund` + @Audit）
- **前端管理端**：`/admin/orders/refund` 台账页（`next/src/lib/refunds-api.ts` + `next/src/app/admin/orders/refund/page.tsx`）——状态筛选 + 订单号搜索 + 通过/驳回弹窗（Modal FooterBar：驳回必填原因）；工单处理弹窗 refund 结果提示「需审核」；工单详情展示退款单状态徽章
- **保留直退**：取消单自动退 / 客户端手动退款仍直退，不建单不审核；审核流只针对「运营判定性退款」（投诉处置）
- **✅ 迁移已应用**（2026-08-21 14:00 用户授权后本机 `migrate resolve --applied 20260821000000_add_tickets_module` + `migrate deploy` 完成，`20260821010000_add_refund` 已落库，14 迁移全绿）；`orders:refund` 权限已在 seed，用户本地只需重跑 `pnpm seed`（权限码/角色绑定）
- **未做**：Phase 2（运营主动发起退款 / 售后工作台聚合 / business 报表直读 Refund 表 / 退款失败对账）

---

## 20. 智能派单模块（2026-08-21 Phase 1 + Phase 1.5 + Phase 2 看板/自动派单落地）

> 设计文档：`docs/dispatch-design.md`（v1.2，含价值分析与匹配算法，**先读第 0 节**）

- **背景**：原始 RBAC 预留「调度派单」含 2 子页（智能派单 + 抢单池），经审视：抢单池与 `/admin/orders/pending` 完全重叠 → 移除；智能派单是唯一功能缺口（现有 `assign()` 从全量师傅盲选）
- **后端**：`orders.service.ts` 新增 `listCandidates(orderId)` — 区域硬过滤（复用 `masterCoversOrder`）+ 技能软加分 + 预约冲突降权 + 负载排序（`groupBy` 批量查在手中订单数）；排序键：skillMatch DESC → conflict ASC → activeOrderCount ASC → rating DESC → orderCount DESC；`orders.controller.ts` 新增 `GET /orders/:id/candidates`（perm `dispatch:smart`）
- **前端**：`/admin/dispatch/smart` 派单工作台（左右分栏：左侧待接单卡片列表 + 右侧推荐师傅面板 + 一键指派 ConfirmDialog + 全量兜底）；`orders-api.ts` 新增 `CandidateMaster` 类型 + `getOrderCandidates()`
- **菜单清理**：`admin-menu.ts` 移除 `dispatch.pool` 子项；`function-points.ts` 移除 `menu:dispatch:pool`；`seed.js` CODES 移除 `dispatch:pool`，`ops_lead` 角色补绑 `dispatch:smart`
- **Phase 1.5 算法增强**（2026-08-21）：① 祖先链技能匹配 — `categoryId` 沿 parent 收集祖先集合，`skills ∩ ancestors` 即命中，返回 `skillMatchDetail`（exact 直接命中 / ancestor 父类目覆盖）+ `matchedCategoryName`，前端徽章区分「技能匹配 / 父类目覆盖（类目名）」；② 预约时间冲突检测 — 订单有 `appointmentDate` 时查候选师傅 active 订单同日预约，`slotsOverlap` 判定（`HH:mm-HH:mm` 区间相交，否则去空白字符串相等），返回 `conflict` + `conflictOrderNo`，前端橙色「时段冲突（单号）」标签；冲突**降权不排除**（排序键 `conflict ASC` 沉底，防「全部冲突无人可派」死局）
- **无新表、无迁移**：推荐查询实时计算，复用现有 Master + Order + ServiceCategory 字段；看板统计与自动派单同样不建表（接单时长口径 = Accepted 的 orderLog 时间 − 订单 createdAt，近似）
- **Phase 2 看板 + 自动派单**（2026-08-21）：① `GET /orders/dispatch/stats`（perm `dispatch:smart`）返回待派/超时/在岗师傅/今日已派/平均接单时长；② `DispatchSchedulerService`（`nest/src/orders/dispatch.scheduler.ts`，setInterval 模式）定时扫描超时未接订单 → `listCandidates` 第一名自动 `assign(orderId, masterId, 'system')`（orderLog `operatorId='system'` 可溯源，**预约单豁免**）；env 可配：`AUTO_DISPATCH_ENABLED`（默认 true）/ `AUTO_DISPATCH_SCAN_MS`（默认 60s）/ `AUTO_DISPATCH_TIMEOUT_MS`（默认 30 分钟）；③ 前端工作台接 `useOrderSocket` `dashboard-refresh` 实时刷新（不再依赖手动刷新）+ 顶部 5 张看板卡片 + 超时订单红色「已超时」徽章
- **⚠️ 用户本地必做**：`pnpm seed`（刷新权限码：移除 `dispatch:pool`、`ops_lead` 绑定 `dispatch:smart`）；重启后端加载自动派单调度器与 stats 端点
- **未做**：LBS 就近排序（需师傅表加坐标字段 + 坐标来源方案，待定）

---

## 21. 短信验证码体系 + 找回密码（2026-08-23 落地）

> 覆盖：管理端登录修复、找回密码全链路、SMS mock/real 双模式、阿里云真实网关、AccessKeySecret 加密存储

### 21.1 管理端登录修复
- **根因**：`phone='admin'` 用户 `passwordHash` 为空且 `staffRoleId=null` → 登录 401「管理员未设置密码」；后续改账号信息又暴露 `UserProfile` 缺失（嵌套 update 要求子记录存在）
- **修复**：补 `passwordHash=bcryptjs('admin123')` + 绑 `super_admin` + 建 UserProfile（nickname=超级管理员）；`users.service.ts` 的 `updateAdmin` 嵌套 `data.profile` 改 **upsert**（`create`+`update` 兜底，杜绝复发）
- **⚠️ 鉴权用 bcryptjs（非原生 bcrypt）**，`auth.service.ts:10`

### 21.2 找回密码全链路
- **后端**：`POST /api/auth/reset-password`（公开无守卫，`reset-password.dto.ts`：phone+code+newPassword≥6）；`auth.service.resetPasswordByCode` OTP 校验后直接 bcrypt 写密码，**不校验旧密码**（旧 `setPassword` 强制 oldPassword 造成死循环）
- **前端**：`/forgot-password` 独立页（手机号→获取验证码→6 位码→新密码确认→跳登录）；登录页密码 tab 加「忘记密码？」链接；发码逻辑换共享函数 `requestSmsCode`（mock 模式拿到 code 时 Toast+console.log）
- **路由**：`route-guards.ts` PUBLIC_ROUTES + `middleware.ts` matcher 均加 `/forgot-password`

### 21.3 SMS mock/real 双模式
- **决策**（虎哥拍板）：所有环境均可切换（生产不锁死 real，风险发布时自行处理）；real 模式真接网关、参数在运营平台配置页自填
- **数据层**：SystemConfig 加 `smsMode String @default("mock")` + `smsAccessKeyId/Secret/SignName/TemplateCode`（均 String?）；迁移 `20260823000000_add_sms_config`（手写 SQL，本地已 `migrate deploy`）
- **后端**：`auth.service.sendSmsCode` 改读 `SystemConfig.smsMode` 分支——mock 返回 `{ok,code,dev}`（验证码随响应回传前端 Toast 提示）；real 调阿里云 provider 不返回 code，凭证缺失抛清晰错误转 400「短信网关未配置完整（缺少 …）」；注入 SystemConfigService（**别名避免与 Nest ConfigService 冲突**）
- **provider**：`nest/src/sms/aliyun-sms.provider.ts`【新建】原生 `fetch`+`crypto` 调阿里云 RPC API（percentEncode + HMAC-SHA1 签名 + base64），**零外部 SDK**（沙箱 pnpm 装包崩溃逼出来的方案，功能等价）
- **前端**：运营平台全局配置页加 smsMode 单选 + real 时显示阿里云四参数表单

### 21.4 AccessKeySecret 加密存储（AES-256-GCM）
- **架构原则**：**加解密只在服务端**——入库前加密、运行时解密传给 provider（HMAC 签名需明文）；对外（浏览器 GET）一律掩码
- **实现**：`config.service.ts` 新增 `encryptSecret/decryptSecret`，密文格式 `enc:v1:<iv>.<tag>.<ciphertext>`（base64）；`updateGlobal` 写入先加密、**空串跳过（保留原值 =「留空不修改」语义）**；非 `enc:v1:` 格式按历史明文兼容
- **密钥**：`nest/.env` 的 `SMS_SECRET_ENCRYPT_KEY`（32 字节 hex 已生成，gitignore 保护不入库）；**未配置/非法时降级明文 + console.warn，不炸运行**
- **API 掩码**：`config.public.controller.ts` GET `global` 返回 `smsAccessKeySecret=''` + `smsSecretSet` 布尔；`getGlobal()` 内部仍返回解密真值供 auth.service 发短信用（不走 HTTP）
- **前端语义**：secret 输入框只作「填写=更新」用途不回显；已配置时提示「已配置，留空则不修改」
- **✅ 验证闭环**：加解密 round-trip（中文/长串/明文兼容/篡改兜底）全过；`tsc --noEmit` EXIT=0；3722 冒烟：PATCH 写入 200 → 公开 GET 掩码 + `smsSecretSet=true` → **mysql CLI 直查落库值为 `enc:v1:` 开头 73 字节密文**（非明文实锤）；3722 已退服

### 21.5 部署链路（重要认知）
- **`deploy.sh` 第 6 步用 `prisma db push`，不是 `migrate deploy`** → schema.prisma 是唯一真相来源；新增字段自动同步生产库无需手动迁移；**但删列会直接丢数据且无确认**（以后删字段务必谨慎，加密方案刻意走「加列/改值」避开此坑）
- `prisma/migrations/` 目录在生产链路不执行（本地 dev 用迁移文件，两套并存）
- 加密复用现有 `smsAccessKeySecret` 列仅值变密文 → schema 不变 → **deploy.sh 零改动**
- GitHub Actions：`deploy.yml`（verify 质量门禁 → SSH 到 ECS 跑 `scripts/deploy.sh`）；2026-08-23 首次部署失败于第 1 步 `git fetch`——`Empty reply from server`（ECS 跨境访问 github.com 网络抖动，与代码无关；修复选项：Re-run / deploy.sh 加 git retry / gitee 镜像）

### 21.6 2026-08-23 踩坑（下次复用）
1. **admin 登录 API 必须带 `role:'admin'` 字段**，否则走验证码登录分支报 400「验证码错误」
2. shell `set -a; . .env` 在沙箱传不进 node 子进程——脚本要自己读 .env 解析 DATABASE_URL
3. 独立 node 脚本的 `@prisma/client` 可能与 dist 运行时 client 不同步（字段 undefined）——核验落库值用 **mysql CLI 直查**最干净
4. C 盘满 0 字节 → Git Bash/Edit/Write 全 ENOSPC（Bash 根挂在 C:）；清 Temp 腾 ~50MB 够小文件编辑
5. 阿里云 SDK（`@alicloud/dysmsapi20170525`）沙箱装不上 → 原生 HTTP 手写签名是可靠替代

---

> **结语**：本文件是所有记忆和规则的汇总入口。完整原文分散在各记忆文件中（见第 1 节索引），但关键约束已在此全部收录。接手时先通读本文件，再按需查阅关联文件即可。
