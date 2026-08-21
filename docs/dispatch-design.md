# 智能派单设计文档

> 版本：v1.2（2026-08-21 Phase 2 看板 + 超时自动派单落地）
> 关联：`docs/orders-sop.md`（订单状态机）、`docs/rbac-design.md`（权限码表）

---

## 0. 实施状态

> **Phase 1 已落地**（2026-08-21）：推荐端点 + 派单工作台 + 抢单池菜单清理。
> **Phase 1.5 已落地**（2026-08-21）：祖先链技能匹配 + 预约时间冲突检测，推荐质量升级。
> **Phase 2 部分落地**（2026-08-21）：派单看板（工作台顶部统计卡片 + WS 实时刷新）+ 超时自动派单（setInterval 定时扫描 + 推荐第一名自动指派）。LBS 就近排序仍待定。
> 实施清单见第 5 节。

---

## 1. 背景

原始 RBAC 设计中「调度派单」作为独立模块预留了 2 个页面：
- `/admin/dispatch/smart` — 智能派单
- `/admin/dispatch/pool` — 抢单池（运营视角）

经审视，**派单闭环本身已由订单模块完整覆盖**（抢单 + 手动指派两条路径均已跑通），唯一真正缺少的是**指派时的智能推荐**——当前管理员指派从全量 active 师傅下拉中盲选，不经任何匹配过滤。

### 决策（2026-08-21）

| 子页面 | 决策 | 理由 |
|---|---|---|
| `/admin/dispatch/pool` 抢单池 | **移除** | 与 `/admin/orders/pending` 完全重叠（同一数据源 `PendingAccept + masterId:null`），无功能增量 |
| `/admin/dispatch/smart` 智能派单 | **实现** | 唯一功能缺口：把全量盲选升级为按区域+技能+负载排序的推荐列表 |

---

## 2. 现状清单（已实现，散落在订单模块内）

| 能力 | 端点 | 说明 |
|---|---|---|
| 师傅抢单池 | `GET /orders/pool` | 按师傅「所在地 ∪ 接单范围」过滤，仅展示 `PendingAccept + masterId:null` |
| 抢单 | `POST /orders/:id/grab` | `updateMany` 原子乐观锁抢占 + 区域二次校验 |
| 管理员指派 | `POST /orders/:id/assign` | 手动指定师傅（需 `orders:edit`），`assign()` 直接转 `Accepted` |
| Admin 待接订单 | `/admin/orders/pending` | 复用 `OrdersTable`，含指派/取消操作 |
| 师傅接单设置 | `/master/me/accept-settings` | 所在地 + 接单范围 + 擅长技能 |
| 地域闸门 | `masterCoversOrder()` | 下单校验 + 抢单校验 + 池子过滤，三处复用 |
| WS 实时推送 | `OrdersGateway` | 新订单入池/状态变更实时推送师傅端 |

### 当前指派流程的缺陷

```
管理员点击「指派」→ 弹窗下拉加载 getMasters({ status: 'active' })
  → 全量 active 师傅列表（不经过任何过滤）
  → 管理员手动凭记忆/经验选择
  → POST /:id/assign { masterId }
```

问题：
1. 不展示哪些师傅覆盖订单地址 → 可能指派到不在服务区域的师傅
2. 不展示师傅擅长技能是否匹配 → 可能指派到不会做该服务的师傅
3. 不展示师傅当前负载 → 可能指派到手上已有多单的师傅
4. 无排序推荐 → 管理员需要在长列表中大海捞针

---

## 3. 智能派单设计

### 3.1 核心思路

新增 `GET /orders/:id/candidates` 查询端点，返回**经过匹配过滤 + 多维排序**的推荐师傅列表。不新建表、不新建模块，仅增强现有 `assign()` 的前置查询。

### 3.2 匹配算法

```
输入：orderId
  ↓
1. 查订单（address + serviceItem.categoryId + status）
   - 仅 PendingAccept + masterId:null 的订单才推荐（已被接走的不再推荐）
  ↓
2. 查全部 active + idVerified 师傅
   select: id, realName, userId, phone(user)
           serviceAreas, skills
           provinceCode, cityCode, districtCode
           rating, orderCount
  ↓
3. 区域过滤（硬门槛）
   复用 masterCoversOrder(master, order.address)
   不覆盖 → 排除（不返回）
  ↓
4. 技能匹配（软加分，**含祖先链**）
   order.serviceItem.categoryId 沿 parent 链向上收集祖先集合（含自身）
   → ancestorIds = { categoryId, parentId, ... }
   master.skills[] 与 ancestorIds 相交 → skillMatch = true
     · 命中自身 → skillMatchDetail = 'exact'（子类目直接匹配）
     · 仅命中祖先 → skillMatchDetail = 'ancestor'（父类目覆盖，如师傅选「家电维修」可接「空调维修」单）
   不匹配 → skillMatch = false（仍返回，但排序靠后）
  ↓
5. 负载查询
   查每个候选师傅当前「在手中」数量：
   status ∈ { Accepted, Departing, Arrived, Servicing, PendingConfirm }
   + masterId = candidate.id
   → activeOrderCount
  ↓
6. 预约时间冲突检测（订单有 appointmentDate 时执行）
   查候选师傅 active 订单中 appointmentDate 与目标订单同日者
   → 时段重叠判定 slotsOverlap(a, b)：
     · 双方均为「HH:mm-HH:mm」格式 → 解析区间做重叠判断
     · 否则（如「上午」等枚举/自由文本）→ 去除空白后字符串相等
   重叠 → conflict = true + conflictOrderNo（首个冲突单号）
   不重叠/无预约 → conflict = false
   无预约时间的订单跳过本步（所有师傅 conflict = false）
  ↓
7. 排序
   排序键（优先级从高到低）：
   a. skillMatch DESC（技能匹配的排前面）
   b. conflict ASC（无时段冲突的优先；冲突降权但不排除，管理员可覆盖）
   c. activeOrderCount ASC（手头越空越优先）
   d. rating DESC（评分高的优先）
   e. orderCount DESC（经验多的优先）
  ↓
8. 返回推荐列表
   [{ masterId, realName, phone, skillMatch, skillMatchDetail, matchedCategoryName,
      conflict, conflictOrderNo, activeOrderCount, rating, orderCount }]
```

### 3.3 排序权重设计说明

- **区域是硬门槛**（不覆盖直接排除），因为 `assign()` 当前不做区域校验（HANDOFF P3 决策暂不加），但智能推荐理应只推荐合理的人选。
- **技能匹配是软加分**（不匹配仍返回），因为师傅 skills 配置可能不全，管理员可凭经验覆盖。匹配粒度含**祖先链**：师傅在接单设置里选了父类目（如「家电维修」）即自动覆盖其全部子类目订单（如「空调维修」），前端以「父类目覆盖」标签区分于直接命中。
- **时段冲突是降权不是排除**：冲突意味着该师傅同一预约时段已有在手单，接单后可能撞车；但强行排除会导致「全部冲突时无单可派」的死局，故保留在推荐列表并沉底，前端标橙色「时段冲突」标签 + 冲突单号，管理员可覆盖决策。
- **技能匹配优先于冲突规避**：排序键 `skillMatch DESC → conflict ASC`。理由是技能是硬能力（干不了活），时段冲突是软约束（可协调），平台不应把「技能不符但空闲」的师傅排在「技能匹配但略忙」的前面。
- **负载排序优先于评分**，因为派单的核心目标是「让订单尽快有人做」，空闲师傅优先。
- **超时自动派单是兜底不是替代**（Phase 2）：人工确认仍是主路径（推荐 + 人工点击指派），只有订单在池子里超时无人认领时，系统才自动指派给推荐第一名。**预约单豁免自动派单**——预约单有客户指定的服务时间，自动指派可能打乱客户计划，留给人工处理。

---

## 3.4 派单看板统计端点（Phase 2）

新增 `GET /orders/dispatch/stats`（`@RequirePerm('dispatch:smart')`），返回工作台顶部看板数据：

```
{
  pendingCount,        // 当前待派：PendingAccept + masterId:null
  overdueCount,        // 其中 createdAt 早于 now - timeoutMs（超时未接，红色告警）
  timeoutMs,           // 超时阈值（前端据此标「已超时」徽章）
  autoDispatchEnabled, // 自动派单开关（展示给管理员，env AUTO_DISPATCH_ENABLED）
  activeMasterCount,   // 在岗师傅：status=active + deletedAt=null
  todayCreated,        // 今日新单（createdAt ≥ 今日 0 点）
  todayAssigned,       // 今日已派（orderLog: fromStatus=PendingAccept→toStatus=Accepted，今日 0 点后）
  avgAcceptMinutes,    // 近 7 日平均接单时长（分钟）：口径 = (Accepted 的 log.createdAt − order.createdAt) 均值。
                       //   order 无独立「入池时间」字段，用 createdAt（支付完成后入池）近似，文档注明。
}
```

- 数据全部实时查询，无新表。
- 前端工作台顶部渲染 5 张卡片：待派 / 超时告警（>0 红色）/ 在岗师傅 / 今日已派 / 平均接单时长。
- 实时性：随 `dashboard-refresh`（WS）与手动刷新一起失效重取。

## 3.5 超时自动派单（Phase 2）

新增 `DispatchSchedulerService`（`nest/src/orders/dispatch.scheduler.ts`），复用 `sla.scheduler.ts` 的 setInterval 模式（沙箱无法安装 @nestjs/schedule）：

| 配置项 | env 变量 | 默认值 | 说明 |
|---|---|---|---|
| 扫描间隔 | `AUTO_DISPATCH_SCAN_MS` | 60s | 定时任务频率 |
| 超时阈值 | `AUTO_DISPATCH_TIMEOUT_MS` | 30 分钟 | 入池超过该时长视为「超时」 |
| 总开关 | `AUTO_DISPATCH_ENABLED` | `true` | `false` 时调度器只统计不派单 |

扫描逻辑（`autoDispatchOverdue()`，幂等）：

```
1. 查超时待派单：status=PendingAccept AND masterId=null
   AND createdAt < now - timeoutMs AND appointmentDate IS NULL（预约单豁免）
  ↓
2. 逐单调 listCandidates(orderId) 取推荐第一名
   - 已被接走（并发）→ 捕获跳过（listCandidates 会抛 BadRequest）
   - 无覆盖师傅（区域无人在岗）→ 跳过，留池子等人工/扩大范围
  ↓
3. assign(orderId, top.masterId, 'system')
   - actorId='system' 写入 orderLog，与管理员指派（真实 userId）可区分
   - transition 内部自动广播 order-update / pool-update / dashboard-refresh
     → 师傅端池子实时移除、管理端工作台实时刷新
```

- 自动派单不新建表、不走 controller（无 @Audit 审计记录，靠 orderLog.operatorId='system' 溯源）。
- 每次扫描 logger 输出本批派单数；无候选/异常的跳过并计数。

## 4. 前端：派单工作台

### 4.1 页面布局

`/admin/dispatch/smart` — 左右分栏布局：

```
┌─────────────────────────────────────────────────────┐
│  智能派单                              共 N 单待派   │
├──────────────────┬──────────────────────────────────┤
│  待接订单列表     │  推荐师傅                        │
│  (左侧 40%)      │  (右侧 60%)                      │
│                  │                                  │
│ ┌──────────────┐ │  订单 #DD20260821xxxx            │
│ │#DD... 空调清洗│ │  空调清洗 · ¥120 · 朝阳区         │
│ │¥120 朝阳区    │ │  预约 08-21 14:00               │
│ │⏱ 入池 12分钟  │ │                                  │
│ └──────────────┘ │  推荐师傅（按匹配度排序）         │
│ ┌──────────────┐ │                                  │
│ │#DD... 洗衣机  │ │  ★ 张师傅    技能匹配 ✓          │
│ │¥80 海淀区    │ │    在手 0 单 · 评分 4.9 · 287 单 │
│ └──────────────┘ │    [指派给张师傅]               │
│                  │                                  │
│                  │  ○ 李师傅    技能未匹配          │
│                  │    在手 2 单 · 评分 4.7 · 156 单 │
│                  │    [指派给李师傅]               │
│                  │                                  │
│                  │  没有合适的？                     │
│                  │  [查看全部在岗师傅] → 展开全量    │
└──────────────────┴──────────────────────────────────┘
```

### 4.2 交互设计

1. **左侧**：待接订单列表（`PendingAccept + masterId:null`），按入池时间排序（最久的在上）。每张卡片显示订单号、服务名、金额、区域、入池时长。
2. **点击左侧订单** → 右侧加载该订单的推荐师傅列表。
3. **右侧推荐列表**：每个师傅卡片显示匹配信息 + 「指派」按钮。点击指派 → ConfirmDialog 二次确认 → `POST /:id/assign`。
4. **全量兜底**：推荐列表底部「查看全部在岗师傅」可展开全量列表（不经过区域过滤），给管理员完全的覆盖能力。
5. **WS 实时刷新**：新订单入池/订单被接走 → 左侧列表实时更新。

### 4.3 权限

- 页面访问：`dispatch:smart`（RBAC 已预留，`dispatcher` + `ops_lead` 角色已绑）
- 指派操作：复用现有 `POST /:id/assign`（需 `orders:edit`）
- 新增 `GET /:id/candidates`：需 `dispatch:smart`

---

## 5. 实施清单

### Phase 1（本轮落地）

- [x] 设计文档（本文档）
- [x] 后端：`orders.service.ts` 新增 `listCandidates(orderId)` — 区域硬过滤 + 技能软加分 + 负载排序
- [x] 后端：`orders.controller.ts` 新增 `GET /orders/:id/candidates`（`@RequirePerm('dispatch:smart')`）
- [x] 前端：`orders-api.ts` 新增 `getOrderCandidates(orderId)` + `CandidateMaster` 类型
- [x] 前端：`/admin/dispatch/smart/page.tsx` 派单工作台（左右分栏 + 推荐列表 + 一键指派 + 全量兜底）
- [x] 菜单清理：`admin-menu.ts` 移除 `dispatch.pool` 子项
- [x] 权限清理：`function-points.ts` 移除 `menu:dispatch:pool`（保留 `dispatch:smart`）
- [x] 类型检查：nest + next `tsc --noEmit` EXIT=0

### Phase 1.5（2026-08-21 落地，推荐质量升级）

- [x] 祖先链技能匹配：`listCandidates` 收集 categoryId 祖先集合（含自身），`skills ∩ ancestors` 即命中；返回 `skillMatchDetail`（exact/ancestor）+ `matchedCategoryName`
- [x] 预约时间冲突检测：目标订单有 `appointmentDate` 时，查候选师傅 active 订单同日预约，`slotsOverlap` 判定冲突（`HH:mm-HH:mm` 区间重叠，否则字符串相等）；返回 `conflict` + `conflictOrderNo`
- [x] 排序键插入 `conflict ASC`（无冲突优先，降权不排除）
- [x] 前端：候选卡片区分「技能匹配 / 父类目覆盖」徽章，冲突时橙色「时段冲突」标签 + 冲突单号
- [x] 类型检查：nest + next `tsc --noEmit` EXIT=0

### Phase 2（2026-08-21 落地：看板 + 自动派单；LBS 待定）

- [x] 派单看板：`GET /orders/dispatch/stats`（待派 / 超时告警 / 在岗师傅 / 今日已派 / 平均接单时长），工作台顶部卡片
- [x] 超时自动派单：`DispatchSchedulerService` 定时扫描超时未接订单 → 推荐第一名自动指派（`actorId='system'`，预约单豁免）
- [x] 前端：工作台接 `useOrderSocket` `dashboard-refresh` 实时刷新（新单入池/被接走不再需要手动刷新）+ 看板卡片 + 超时徽章
- [x] 类型检查：nest + next `tsc --noEmit` EXIT=0
- [ ] 地图就近排序：接入 LBS，按师傅与订单地址距离排序（需师傅表加坐标字段 + 坐标来源方案，待定）

---

## 6. 关键设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 是否新建表 | **否** | 推荐查询是实时计算，不需要持久化；复用现有 Master + Order 字段 |
| 是否新建权限码 | **否** | `dispatch:smart` 已在 RBAC seed 中预留 |
| 技能匹配粒度 | **祖先链（Phase 1.5）** | `master.skills` 存类目节点 ID；匹配 `categoryId` 的祖先集合（选父类目自动覆盖子类目订单），命中方式返回 exact/ancestor |
| 时段冲突策略 | **降权不排除** | 排序键 `conflict ASC` 沉底 + 前端标签展示；避免「全部冲突时无人可派」死局 |
| slot 重叠判定 | **区间解析优先，字符串兜底** | `HH:mm-HH:mm` 可解析则区间重叠；枚举/自由文本（如「上午」）去空白后相等即冲突 |
| 区域是否硬过滤 | **是** | 推荐只给合理人选；但全量兜底保留管理员覆盖权 |
| 是否自动派单 | **兜底（Phase 2）** | 主路径仍是人工确认；超时未接才自动指派推荐第一名，预约单豁免，`actorId='system'` 可溯源 |
| 看板数据来源 | **实时查询，无新表** | `GET /orders/dispatch/stats` 现算；接单时长口径 = Accepted 的 orderLog 时间 − 订单 createdAt（近似） |
| 定时任务实现 | **setInterval（沿用 sla.scheduler）** | 沙箱无法安装 @nestjs/schedule；env 可配扫描间隔/阈值/总开关 |
| 负载查询方式 | **groupBy 批量** | 一次 `groupBy` 查全部候选在手单数，避免 N+1；冲突查询同理一次 `findMany` |
