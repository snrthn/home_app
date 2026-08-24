# 投诉与工单管理模块设计文档

> 状态：**Phase 1 已实施（2026-08-21，前端 typecheck 通过）**  ·  版本：v1.1  ·  设计定稿：2026-08-20
> 适用范围：运营端（`/admin`）+ 客户端 + 师傅端
> 关联文档：`rbac-design.md`（权限码 `complaints:handle` / `tickets:manage` 已入库）、`orders-sop.md`（退款/分账闭环）

---

## 0.5 实施状态（2026-08-21，先读这节）

**Phase 1 已落地**（后端模块 + 管理端两页 + 客户端投诉页），与设计的差异与注意点：

| 项 | 实施情况 |
|---|---|
| 数据层 | ✅ `schema.prisma` 三模型 + 5 枚举 + 关系已加；迁移为**手写 SQL** `prisma/migrations/20260821000000_add_tickets_module/migration.sql`（沙箱无 DB 无法 diff，MySQL 方言对齐 baseline 约定）。✅ **已应用**（2026-08-21 14:00 用户授权后本机 `migrate resolve --applied` 补账 + `migrate deploy` 完成，14 迁移全绿） |
| 后端模块 | ✅ `nest/src/tickets/`（controller 7 端点 + service + `sla.scheduler.ts`）；complaints 处置直接合入 tickets 模块（`POST /tickets/:id/complaint/resolve`），未单独建模块 |
| SLA 定时任务 | ⚠️ **差异**：`@nestjs/schedule` 沙箱装不了 → `sla.scheduler.ts` 用原生 `setInterval` 等价实现，`SLA_SCAN_MS` 环境变量可调（默认 5 分钟） |
| 权限种子 | ✅ `nest/prisma/seed.js`（CommonJS 直连 `.prisma/client` 生成客户端，绕开 pnpm 双副本坑）：写 `complaints:handle`/`tickets:manage` 入 Permission 表并绑定 `cs_agent`/`ops_lead`。⚠️ 用户本地须执行 `pnpm seed` |
| WS | ✅ `tickets-pool` 房间 + `ticket-update` 事件（`orders.gateway.ts`），管理端两页实时刷新 |
| 管理端两页 | ✅ `/admin/reviews/tickets` + `/admin/reviews/complaints`；交互为**操作列【详情/处理/改派】三入口 + 三独立弹窗**（`TicketDetail` 纯只读 / `TicketProcess` 处理·结案 / `TicketAssign` 改派），确认按钮走 Modal FooterBar 规范 |
| 客户端 | ✅ 入口为个人中心「我的投诉」→ 独立页 `/client/complaints`（提交表单）+ `/client/complaints/history`（投诉记录），历史入口在表单底部文本链接 + headerBar 菜单 |
| Phase 2（师傅端我的工单 / 工作台指标卡 / SLA 倒计时展示 / 订单详情投诉按钮 / 评价引导） | ✅ 已落地（2026-08-21） |
| 端到端联调 | ❌ 未做（沙箱无 DB/不能起服务）；迁移已应用，剩 `pnpm seed` 后由用户本地验证 |
| 类型坑 | `@prisma/client` re-export 在本项目破损，Prisma 类型一律走相对路径 `../../node_modules/.prisma/client`（与 PrismaService 一致） |

---

## 0. 背景与现状

- **DB 层**：`Ticket` / `Complaint` / `TicketComment` 三表已入 schema + 迁移 SQL（见 0.5 节，✅ 已应用）。
- **代码层**：`nest/src/tickets/` 模块已实现（见 0.5 节）。
- **RBAC 已预留口子**（`rbac-design.md` 第 4 节）：
  - `complaints:handle` → 管理端 `/admin/reviews/complaints`
  - `tickets:manage`   → 管理端 `/admin/reviews/tickets`
  - 预设岗位角色 `cs_agent`（客服专员）已含 `tickets:manage` + `complaints:handle` + `reviews:moderate` + `orders:refund`。

现状即「架构已留洞、实现未填」，本设计负责把它闭环。

---

## 1. 关键决策（已与产品确认）

| # | 决策点 | 结论 |
|---|---|---|
| 1 | 模块关系 | **工单底座 + 投诉挂件**：工单是统一流转载体，投诉是 `type=complaint` 且带处置权的一类工单。`tickets:manage` 管全工单流转，`complaints:handle` 才能对投诉做处置（退款/赔付/重派）。 |
| 2 | 投诉入口范围 | **仅已完成订单可投诉**：提交投诉时强校验 `order.status ∈ { reviewed, evaluated }`。进行中订单走取消/退款通道，不进投诉。 |
| 3 | 「重新服务」处置 | Phase 1 **只记录结果、人工线下安排**，不自动建新订单、不自动免单。 |
| 4 | SLA 自动升级 | **需要自动升级流转**（非仅展示）：超时工单由定时任务自动升级优先级 + 改派受理人 + 写内部备注 + WS 通知。 |

---

## 2. 整体架构：工单底座 + 投诉挂件

```
                ┌──────────── 工单池（统一载体）────────────┐
  客户端提交 ──▶ │  Ticket(type=consult/complaint/refund/   │ ◀── 师傅端申诉
                │         report/system)                    │
  订单完成 ──▶   │   status: open→processing→pendingUser→   │ ◀── 管理端受理/流转
  (1-2星评价)    │           resolved→closed / rejected     │
                └───────────────┬───────────────────────────┘
                                │ type=complaint 时挂 1:1 Complaint
                                ▼
                  Complaint(被投诉师傅 / 原因 / 期望 / 处置结果)
                                │ 处置结果四选一
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
       refund 退款         compensate 补偿       redispatch 重派    no_fault 无责
     (orders.transition    (Settlement          (仅记录+通知     (直接 resolved
      阶梯退款 +           type=compensation)    运营线下安排)     → closed)
      compensation 单)
```

**为什么不是两套系统**：一套状态机、一张工单表，投诉页只是 `type=complaint` 的过滤视图 + 处置动作差异；处理结果四选一全部复用现有资产（退款走 `orders.transition` + 阶梯退款、赔付走 `type=compensation` 结算单、全程 `@Audit`、WS 房间订阅），不另起炉灶。

---

## 3. 工单状态机

```
                         assignee 首次响应
   open ───────────────────────────────────────▶ processing
    │  (新建，待受理)                              │  (受理中)
    │                                            │
    │ 客户补充材料/改约                   等待用户确认方案
    └───────────────────────────────────── pendingUser
                                              │
                                      用户确认/超时
                                              ▼
                                        resolved ──(7天无操作自动 closed)──▶ closed
                                              │
                                       客服判定不成立的投诉
                                              ▼
                                        rejected ────────────────────────▶ closed

   任意状态均可被 SLA 自动升级：priority 升级 + assignee 改派 + 内部备注
```

| 状态 | 含义 | 进入条件 |
|---|---|---|
| `open` | 待受理 | 新建工单（客户提交 / 系统生成） |
| `processing` | 受理中 | 客服首次响应（第一条对外可见 comment 或显式「受理」动作） |
| `pendingUser` | 待用户确认 | 给出处置方案，等待用户确认 |
| `resolved` | 已解决 | 用户确认方案 / 投诉判定成立并执行处置 |
| `rejected` | 已驳回 | 投诉判定不成立（如证据不足、超出范围） |
| `closed` | 已关闭 | `resolved` 后 7 天无操作惰性判定；或 `rejected` 后关闭 |

---

## 4. SLA 与自动升级流转（决策点 4）

### 4.1 两档 SLA 截止时间

每张工单存两个截止字段，建单时按优先级计算：

| 优先级 | 首响 `firstResponseDeadline` | 处理完结 `resolveDeadline` |
|---|---|---|
| `urgent` | 30 分钟 | 8 小时 |
| `high` | 2 小时 | 24 小时 |
| `normal` | 24 小时 | 72 小时 |
| `low` | 72 小时 | 7 天 |

投诉工单默认 `high`；`reason=damage`（损坏物品）强制 `urgent`。

### 4.2 升级规则（定时任务驱动，非惰性）

新增 `SlaService` + `@nestjs/schedule` 的 `Cron`（每 5 分钟扫描一次）。扫描 `status ∈ {open, processing, pendingUser}` 的活跃工单：

- **首响超时**（`now > firstResponseDeadline` 且仍 `open`）：
  - `priority` 升一级（`low→normal→high→urgent` 封顶）；
  - 写一条 `isInternal=true` 的 `TicketComment`（内容如「首响 SLA 超时，自动升级」）；
  - 若原 `priority ∈ {high, urgent}`，将 `assigneeId` 改派给具备 `complaints:handle` / 工单管理权限的主管（`ops_lead` 角色账号），并通过 WS 推送提醒。
- **处理超时**（`now > resolveDeadline` 且非终态）：
  - `escalationLevel += 1`（0→1→2，封顶 2）；
  - `priority = urgent`；
  - `assigneeId` 改派给 `ops_lead`；
  - 写内部备注 + WS 通知主管。
- **幂等**：同一工单对同一档 SLA 只升级一次（用 `escalatedFirstResponse` / `escalatedResolve` 两个布尔标记位，避免重复升级刷屏）。

> 说明：决策点 4 明确要求「自动升级流转」，因此 Phase 1 即实现 Cron 扫描 + 改派 + 备注 + 通知，而不只是列表倒计时标红。惰性的「resolved 后 7 天自动 closed」仍用查询时现算（不上 cron），减轻定时任务负担。

---

## 5. 数据模型（Prisma 草图）

```prisma
// ---------------- 工单 / 投诉（2026-08-20 新增） ----------------

enum TicketType {
  consult     // 咨询
  complaint   // 投诉（挂件）
  refund      // 退款申请
  report      // 举报
  system      // 系统异常
}

enum TicketStatus {
  open
  processing
  pendingUser
  resolved
  rejected
  closed
}

enum TicketPriority {
  low
  normal
  high
  urgent
}

enum ComplaintReason {
  attitude   // 服务态度
  quality    // 技术质量
  fee       // 乱收费
  late      // 迟到爽约
  damage     // 损坏物品（强制 urgent）
  other
}

enum ComplaintResult {
  refund       // 退款（走 orders.transition 阶梯退款）
  compensate    // 补偿（平台承担，Settlement.compensation）
  redispatch    // 重新服务（仅记录，人工线下安排）
  no_fault      // 无责关闭
}

model Ticket {
  id            String       @id @default(cuid())
  ticketNo      String       @unique            // GT + yyyyMMdd + 4位序列，如 GT202608200001
  type          TicketType
  source        String                            // client | master | admin | system
  title         String       @db.VarChar(100)
  content       String       @db.Text
  images        Json?                            // 客户上传凭证
  status        TicketStatus @default(open)
  priority      TicketPriority @default(normal)

  // 关联三主体（均可空，系统类工单无关联）
  orderId       String?
  order         Order?        @relation(fields: [orderId], references: [id])
  reviewId      String?                           // 评价后引导投诉时关联
  review        Review?       @relation(fields: [reviewId], references: [id])
  customerId    String?                          // 提交人（客户）
  customer      User?         @relation("TicketCustomer", fields: [customerId], references: [id])
  masterId      String?                          // 被投诉/相关师傅
  master        Master?       @relation(fields: [masterId], references: [id])

  assigneeId    String?                          // 受理客服 userId（cs_agent）
  assignee      User?         @relation("TicketAssignee", fields: [assigneeId], references: [id])

  // SLA
  firstResponseDeadline DateTime?
  resolveDeadline       DateTime?
  escalatedFirstResponse Boolean @default(false) // 首响是否已升级（防重复）
  escalatedResolve       Boolean @default(false) // 处理是否已升级
  escalationLevel        Int     @default(0)

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  closedAt      DateTime?

  deletedAt     DateTime?

  complaint      Complaint?
  comments       TicketComment[]

  @@index([status, priority])
  @@index([assigneeId, status])
  @@index([orderId])
  @@index([customerId])
}

model Complaint {
  ticketId            String          @id                 // 1:1，复用 Ticket.id
  ticket              Ticket          @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  againstMasterId     String?                              // 被投诉师傅
  reason              ComplaintReason
  expectation         String?                             // 用户期望：退款/重做/赔偿
  result              ComplaintResult?                    // resolved 时必填
  handledById         String?                             // 处置人 userId
  refundSettlementId  String?                             // 关联 compensation 结算单（result=refund/compensate 时）
  handledAt           DateTime?
  createdAt           DateTime        @default(now())
}

model TicketComment {
  id          String   @id @default(cuid())
  ticketId    String
  ticket      Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  operatorId  String?                                      // 留言人（客服/客户/师傅）
  content     String   @db.Text
  isInternal  Boolean  @default(false)                     // true=内部备注（仅客服可见，不对外）
  visibleTo   String   @default("all")                    // all | customer | master（对外可见范围）
  createdAt   DateTime @default(now())

  deletedAt   DateTime?

  @@index([ticketId])
}
```

> `User` 需新增两个关系字段 `ticketsAsCustomer Ticket[] @relation("TicketCustomer")` 与 `ticketsAsAssignee Ticket[] @relation("TicketAssignee")`；`Order` / `Review` / `Master` 各加一个 `tickets Ticket[]` 反向关系（保持 Prisma 关系完整，可空）。

---

## 6. 三端入口与页面

| 端 | 入口 | 页面 | 权限 |
|---|---|---|---|
| 客户端 | 个人中心「我的投诉」→ 独立提交页 `/client/complaints`（底部+headerBar 双入口进 `/client/complaints/history` 投诉记录）；订单详情「投诉」按钮与评价 1-2 星引导（**本期 Phase 2 目标**） | 提交表单 + 投诉记录列表 | 登录即可提交 |
| 师傅端 | 被投诉时 WS 公告 + 我的工单入口 | 我的 → 我的工单（查看 + 申诉回复） | **本期 Phase 2 目标** |
| 管理端 | 侧边栏「评价客服」下挂两页 | `/admin/reviews/tickets`（工单池：操作列【详情/处理/改派】三弹窗）；`/admin/reviews/complaints`（投诉处置：对齐 `complaints:handle` 路由，同款三弹窗） | `tickets:manage` / `complaints:handle` |
| 管理端 | 工作台「待处理工单」指标卡 | 复用现有 dashboard 数据卡 | `reports:view` / `tickets:manage` |

---

## 7. 与现有模块咬合

| 现有能力 | 本设计如何复用 |
|---|---|
| `orders.transition()` 状态机 | `result=refund` 时调 `orders.transition`（refunding→refunded），走 `CommissionModule` 快照 + 阶梯退款；生成 `type=compensation` 结算单。 |
| `Settlement`（compensation 类型） | `result=compensate` / `refund` 的师傅应退部分，复用补偿结算单，管理端审核入账。 |
| `Review` 模型 | 投诉提交时若由评价引导，关联 `reviewId`；1-2 星评价前端引导至投诉页。 |
| `rbac-design.md` | 直接复用预留的 `complaints:handle` / `tickets:manage` 权限码；后端 `@RequirePerm` 守卫，前端 `usePerm` 显隐。 |
| `AuditInterceptor` + `@Audit` | 受理、改派、处置、关闭等写操作全部标 `@Audit`，落 `OperationLog`。 |
| WebSocket Gateway | 新增 `tickets-pool` 房间（工单池实时刷新）+ 升级/改派提醒事件，沿用现有房间订阅机制。 |
| `Order.status ∈ {reviewed, evaluated}` | 投诉入口强校验：仅这两终态可提交投诉（决策点 2）。 |

---

## 8. 分期实现路线

### Phase 1（闭环最小集，本期目标）— ✅ 已落地（2026-08-21）
1. ✅ **数据层**：`schema.prisma` 新增枚举 + `Ticket` / `Complaint` / `TicketComment` 三模型 + 反向关系；迁移 SQL 手写（见 0.5 节差异说明）。
2. ✅ **后端模块**：`tickets` 模块（controller / service），complaints 处置端点合入 tickets 模块。
3. ✅ **权限种子**：`nest/prisma/seed.js` 写权限码 + `cs_agent`/`ops_lead` 绑定。
4. ✅ **SLA 自动升级**：`sla.scheduler.ts`（setInterval 实现，等价 Cron，见 0.5 节差异说明）。
5. ✅ **WS**：`tickets-pool` 房间 + `ticket-update` 事件。
6. ✅ **管理端两页**：工单池 + 投诉处置（操作列三入口 + 三独立弹窗，见 0.5 节）。
7. ✅ **客户端**：投诉提交（校验已完成订单）+ 投诉记录查看（`/client/complaints` + `/history`）。

### Phase 2（已落地，2026-08-21）

#### 2.1 师傅端「我的工单」查看 + 申诉
- **后端**：`GET /tickets/mine` 当前仅按 `customerId` 过滤（客户端视角）。改造为按角色分支：`tickets.controller.ts` 的 `mine` 将 `req.user.role` 传入 `listMine(actorId, role)`；`service.listMine` 当 `role==='master'` 时 `where: { masterId: actorId }`，否则 `customerId: actorId`。前端 `master/tickets` 复用同一端点。
- **申诉端点**：新增 `POST /tickets/:id/appeal`（@Audit），service 复用 `addComment(actorId, id, { content, isInternal:false, visibleTo:'master' })`——语义为师傅对外申诉（客服可见），**零迁移**。
- **前端**：新建 `master/tickets` 页，复用 `getMyTickets()` + `DataTable` + `TicketListItem`；列表列：工单号 / 类型 / 状态 / 关联订单 / 优先级 / 创建时间；行内「申诉」按钮弹 Modal 调 `appealTicket`；`master` 侧边栏加「我的工单」入口。

#### 2.2 工作台「待处理工单」指标卡
- **后端**：`reports.service.dashboard()` 增加 `pendingTickets = prisma.ticket.count({ where: { status: 'open' } })`（待受理即待处理）。
- **前端**：`admin/page.tsx` 的 `stats` 数组追加 `{ label:'待处理工单', value: pendingTickets }`。

#### 2.3 SLA 倒计时前端展示（超时标红）
- **前端**：`admin/reviews/tickets` 列表新增「SLA」列，取 `firstResponseDeadline` / `resolveDeadline` 中尚未到达的较小者计算剩余时间；均已过期则显示「已超时」标红。纯前端，无新端点（截止时间字段已落库）。

#### 2.4 订单详情「投诉」按钮（客户端）
- **前端**：`client/orders/[id]` 当 `order.status ∈ { reviewed, evaluated }` 时显示「投诉」按钮，跳转 `/client/complaints?orderId=...&againstMasterId=...`。强校验在后端 `createTicket` 已做。

#### 2.5 评价 1-2 星引导投诉
- **前端**：客户端评价提交页，当 `rating <= 2` 时提交成功提示「评价较低，是否需要投诉？」并提供跳转投诉页链接；评价页底部常驻引导入口。

### Phase 2 实施清单（本期）
- [x] 后端 `listMine` 加角色分支（masterId / customerId）
- [x] 后端 `POST /tickets/:id/appeal` 端点 + service 复用 `addComment(visibleTo:'master')`
- [x] 前端 `tickets-api.ts` 加 `appealTicket()`
- [x] 前端 `master/tickets` 页（列表 + 申诉 Modal）
- [x] `master` 菜单加「我的工单」入口
- [x] 后端 `dashboard()` 加 `pendingTickets`
- [x] 前端 `admin/page.tsx` 加待处理工单指标卡
- [x] 前端 `admin/reviews/tickets` 加 SLA 倒计时列（每 30s 实时刷新）
- [x] 前端 `client/orders/[id]` 加投诉按钮（reviewed/evaluated）
- [x] 前端 评价页 1-2 星引导投诉（低分提示 + 订单详情投诉按钮预填 orderId/againstMasterId）

### Phase 3
- 师傅违规记录累计（admin 师傅详情可见）。
- 投诉成立后关联差评隐藏 / 权重下调。
- 工单统计报表（来源分布、SLA 达标率）。

---

## 9. 验收用例（Phase 1）

1. 客户在 `reviewed` 订单详情点「投诉」→ 选原因 / 上传凭证 → 提交成功，生成 `type=complaint` 工单，`priority=high`。
2. 管理端工单池看到新工单 → 受理（status→processing）→ 内部备注（isInternal）→ 给出方案（pendingUser）。
3. 客户确认方案 → 处置选 `refund` → 调 `orders.transition` 阶梯退款 + 生成 compensation 结算单 → resolved。
4. SLA 验证：构造一张 `firstResponseDeadline` 在过去的工单，等待 Cron（或手动触发 SlaService）→ 优先级升级 + 内部备注 + WS 通知。
5. 约束验证：在 `accepted` / `servicing` 等未完成订单详情，**不显示**投诉入口；调用提交接口返回 403/校验失败。
6. 师傅端（Phase 2）被投诉时能收到 WS 提醒。

---

## 10. API 草图（Phase 1）

```
POST   /tickets                     # 客户端/系统提交工单（投诉走 type=complaint + 校验 order.status）
GET    /tickets                     # 工单池列表（filter: status/type/priority/assignee）
GET    /tickets/:id                 # 工单详情（含 complaint + comments）
POST   /tickets/:id/comments        # 添加留言（isInternal / visibleTo）
POST   /tickets/:id/assign          # 改派受理人（tickets:manage）
POST   /tickets/:id/status          # 状态流转 open→processing→pendingUser→resolved/rejected→closed
POST   /tickets/:id/complaint/resolve  # 投诉处置（complaints:handle）：result 四选一，联动退款/补偿
POST   /admin/reviews/complaints    # 投诉处置页聚合端点（路由对齐 RBAC）
```
