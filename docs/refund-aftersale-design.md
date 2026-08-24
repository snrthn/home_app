# 退款/售后（订单退款审核）设计文档

> 状态：**Phase 1 已实施** · 版本：v1.1 · 日期：2026-08-21
> 适用范围：管理端（`/admin/orders/refund`）+ 投诉处置联动
> 关联文档：`orders-sop.md`（退款/分账闭环）、`complaints-tickets-design.md`（投诉工单）、`rbac-design.md`（`orders:refund` 权限）
> 状态流转：v1.0（2026-08-21）价值判断定稿 → v1.1（同日）Phase 1 最小闭环落地

---

## 0. 背景：能力闭环了，但运营视角是空白的

退款引擎早已完整闭环（阶梯分账、渠道退款、状态机、审计日志全在后端），但**运营端没有任何一处能"看见并管控"退款这件事本身**。菜单里的「退款/售后」（`/admin/orders/refund`）一直是占位——页面目录不存在，点击即 404。

本设计的核心判断：**退款"能力"已闭环，"运营视角"是空白——这正是这个页面的价值所在。**

## 1. 现状盘点（已核实代码）

| 触发入口 | 实现 | 问题 |
|---|---|---|
| 取消单自动退 | `orders.service.cancel()` → `payments.refund()`（服务前任意阶段） | 客户正当权利，直退合理 |
| 投诉处置联动退 | `tickets.service.resolveComplaint()` result=refund → `payments.refund()` | **发起即执行，无审核；且该路径实际是坏的（见第 3 节）** |
| 手动退款端点 | `POST /payments/refund`（客户） | 服务前取消的兜底，直退合理 |

数据落点：**没有 Refund 记录表**（schema 只有 `Payment`，无 `Refund` 模型）——退款痕迹散在订单备注（orderLog）、审计日志、compensation 结算单三处，无法回答"这个月退了多少、退给谁、什么原因"。

## 2. 价值分层（按投入产出排序）

1. **钱的管控——最高价值，唯一功能缺口**。退款台账 = 财务日结对账的第一手数据；待审核态把"自动退款"升级为"可管控的退款"（恶意投诉退款、师傅未上门退款等场景需要人工把关）。
2. **售后运营视图——中价值**。退款/补偿/投诉聚合一屏看；阶梯退款的师傅补偿（`masterCompensation`）目前只有师傅端收入明细可见，运营端缺汇总视角。
3. **数据基建——低价值，顺带受益**。`business` 报表退款口径由补偿单反推（settledAt 近似退款时间）有失真风险；建 Refund 表后报表可改直读。

## 3. 关键发现：投诉处置的退款路径实际是坏的

核对代码时发现 `resolveComplaint` result=refund 对已完单（reviewed/evaluated）订单调用 `payments.refund()` 会被**双重拦截**：

1. `refund()` 第一道校验：`REFUNDABLE_STATES` 仅含支付后托管态（pending_accept…pending_confirm）+ refunding，**不含 reviewed/evaluated** → 直接抛「该订单当前不可退款」；
2. 即使放行，`refund()` 内部 `orders.transition(→refunding)` 走 `canTransition`（`shared/src/types.ts` 的 `ORDER_STATUS_FLOW`），reviewed/evaluated **均无 refunding 出口** → 抛「状态不可流转」。

即：投诉处置选「退款」从未真正成功过。本次 Phase 1 顺带修复（状态机放行已完单→退款中，仅在投诉审核通过的场景触发）。

## 4. Phase 1 最小闭环（本期已实施）

### 4.1 数据层：`Refund` 表（新模型）

```prisma
enum RefundStatus {
  pending_review // 待审核
  approved       // 已通过（退款已执行）
  rejected       // 已驳回
}

model Refund {
  id             String       @id @default(cuid())
  refundNo       String       @unique            // RF + yyyyMMdd + 4位序列
  orderId        String
  ticketId       String?                          // 来源工单（投诉处置 result=refund 时）
  amount         Decimal      @db.Decimal(10, 2)  // 申请退款金额（= 订单金额）
  reason         String?      @db.VarChar(200)
  status         RefundStatus @default(pending_review)
  requestedById  String?                          // 发起人（投诉处置的运营）
  reviewedById   String?                          // 审核人
  reviewedAt     DateTime?
  reviewNote     String?      @db.VarChar(200)    // 驳回理由 / 审核备注
  refundedAmount Decimal?     @db.Decimal(10, 2)  // 实际退用户金额（阶梯实退）
  settlementId   String?                          // 通过后生成的 compensation 结算单
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?
}
```

### 4.2 后端：审核端点 + 状态机放行

- `shared/src/types.ts`：`ORDER_STATUS_FLOW` 放行 `Reviewed → Refunding`、`Evaluated → Refunding`（已完单仅投诉审核通过可退款）；
- `payments.service.ts`：
  - `refund()` 增加 `opts?: { allowCompleted?: boolean; reason?: string }`（默认行为不变，取消单直退不受影响）；
  - 新增 `createRefundRequest()`（投诉处置调用，生成 RF 单号，同订单已有待审核/已通过单则拒绝重复申请）；
  - 新增 `listRefunds(filter)`（台账查询：状态 / 订单号筛选，关联订单、工单、发起人、审核人、结算单）；
  - 新增 `reviewRefund(id, actorId, { action, note? })`：approve → 执行 `refund(allowCompleted)` → 回填实退金额与补偿结算单 id；reject → 置 rejected + 工单追加内部备注；
- `payments.controller.ts`：`GET /payments/refunds`、`POST /payments/refunds/:id/approve`、`POST /payments/refunds/:id/reject`（管理端，权限 `orders:refund`，含 @Audit）；
- `tickets.service.ts` `resolveComplaint`：result=refund 由「发起即执行」改为「创建退款申请（pending_review）」，工单照常 resolved，退款在台账审核通过后执行。

### 4.3 投诉处置改造：发起即执行 → 申请审核

| | 改前 | 改后 |
|---|---|---|
| result=refund | 直接 `payments.refund()`（且必失败，见第 3 节） | 创建 Refund 申请单，待审核 |
| 前端提示 | 无 | 「提交后生成退款申请，需运营在『退款/售后』审核通过后执行」 |
| 审核通过 | — | 执行阶梯退款 + 生成 compensation 结算单（师傅补偿，仍走结算台账确认入账） |
| 审核驳回 | — | 退款单置 rejected + 工单内部备注，可再沟通 |

### 4.4 管理端：退款/售后台账页（`/admin/orders/refund`）

- 菜单入口**已存在**（订单管理 → 退款/售后，perm `orders:refund`，ops_lead 已绑），本轮补页面实体；
- 台账列表：退款单号 / 订单号（链接订单详情）/ 客户 / 申请金额 / 实退金额 / 原因 / 来源工单 / 状态 / 申请时间 / 审核人；
- 状态筛选：全部 / 待审核 / 已通过 / 已驳回；
- 操作（仅待审核行）：**通过**（确认弹窗，提示按阶梯规则实退）/ **驳回**（必填理由弹窗）——按项目 Modal FooterBar 规范；
- 状态徽章与全站 StatusBadge 风格一致（待审核橙 / 已通过绿 / 已驳回灰）。

### 4.5 保留直退的路径（不做审核）

- **取消单自动退**：客户在服务前取消，属正当权利，维持直退；
- **客户端手动退款兜底**（`POST /payments/refund`）：同上。
- 说明：审核流只针对「运营判定性退款」（投诉处置），用户自主操作不拦。

### 4.6 实施清单（Phase 1）

- [x] `Refund` 模型 + `RefundStatus` 枚举 + 手写迁移 SQL（`20260821010000_add_refund`）
- [x] 状态机放行 reviewed/evaluated → refunding（shared，已重建 dist）
- [x] `refund()` 支持已完单场景（allowCompleted + 自定义 reason）
- [x] `createRefundRequest` / `listRefunds` / `reviewRefund`（approve / reject）
- [x] 后端 3 端点（GET 台账 / POST approve / POST reject，`orders:refund` + @Audit）
- [x] `resolveComplaint` result=refund 改为创建退款申请
- [x] 管理端退款/售后台账页（列表 + 状态筛选 + 通过/驳回弹窗）
- [x] 工单处理弹窗 refund 结果提示「需审核」；工单详情展示退款单状态
- [ ] **用户本地剩项**：重跑 `pnpm seed`（`orders:refund` 权限已在 seed，无需新增；迁移 `20260821010000_add_refund` 已于 2026-08-21 14:00 应用）

## 5. Phase 2 实施设计（已落地，2026-08-21）

### 5.1 运营主动发起退款
- **后端**：`createRefundRequest` 的 `ticketId` 类型由必填改为可选（`ticketId?: string`），支持非工单来源的退款申请。新增 `POST /payments/refunds`（@RequirePerm `orders:refund`，@Audit），入参 `{ orderNo: string, amount?: number, reason?: string }`：按 `orderNo` 解析订单 → 调 `createRefundRequest({ ticketId: null, orderId, amount: amount ?? order.amount, reason, requestedBy })`；同订单已有待审核/已通过单仍拒重复（复用现有幂等校验）。
- **前端**：`refunds-api.ts` 加 `createRefund(orderNo, amount?, reason?)`；`admin/orders/refund` 页加「发起退款」按钮 → Modal（输入订单号 / 金额 / 原因）→ 提交进审核流。
- **路由顺序**：新增 `POST('refunds')` 与既有 `GET('refunds')` 同路径不同方法、与 `POST('refunds/:id/approve')` 不同路径，无冲突。

### 5.2 售后工作台聚合
- **后端**：无新端点，复用 `GET /tickets`（active 筛选）+ `GET /payments/refunds`（pending_review 筛选）。
- **前端**：新建 `admin/aftersale` 页，顶部指标卡（待审核退款 / 进行中工单 / 待处理工单）+ 两区块（工单列表 + 退款台账）；`admin` 菜单加「售后工作台」入口（perm 复用 `orders:refund`）。

### 5.3 报表口径直读 Refund 表
- **后端**：`reports.service.business()` 将退款口径由「补偿单反推（`orderAmount - platformFee - masterAmount`）」改为直读 `Refund` 表（`status='approved'`，累加 `refundedAmount ?? amount`），`settledAt` 近似退款时间。前端 `admin/reports/business` 展示字段不变，自动生效。

### Phase 2 实施清单（本期）
- [x] 后端 `createRefundRequest` 的 `ticketId` 改可选
- [x] 后端 `POST /payments/refunds`（主动发起，orders:refund + @Audit）
- [x] 前端 `refunds-api.ts` 加 `createRefund()`
- [x] 前端 `admin/orders/refund` 加「发起退款」Modal（按订单号主动建单）
- [x] 前端 `admin/aftersale` 页（指标卡 + 工单/退款两区块）
- [x] `admin` 菜单加「售后工作台」入口
- [x] 后端 `business()` 退款口径直读 `Refund` 表

## 6. 约定与约束

- 权限复用 `orders:refund`（CODES 已含，ops_lead 已绑），不新增权限码；
- 退款单号 `RF + yyyyMMdd + 4位序列`（按日计数，与工单 GT 号同构）；
- 同订单同时只允许一条待审核/已通过退款单（重复申请拦截）；
- 审核通过即执行退款（无"通过后待执行"中间态）；执行失败保持 pending_review 可重试；
- 已完单退款金额按阶梯规则：reviewed/evaluated 不在取消生命周期内 → `resolveTierRatio` 兜底**全额退**，平台留成与师傅补偿按订单快照拆分。
