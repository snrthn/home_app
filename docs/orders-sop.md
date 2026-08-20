# 下单接单流程 SOP（home_app）

> 文档定位：下单 / 接单 / 服务 / 支付 / 验收 / 退款 这一核心交易闭环的业务要领与进度台账。
> 维护方式：本文件随 SOP 推进持续更新；状态变更请同步记一笔（日期 + 结论）。
> 创建：2026-08-13
> 最近改写：2026-08-20 **三端订单页全量落地 + 分账引擎/阶梯退款/地域闸门收口**
> 当前状态：**前后端订单闭环已跑通（三端订单页 + 结算台账 + 师傅收入页已建）；分账规则引擎、阶梯退款、地域闸门 P0+P1 已落地；剩余 P2/P3：WS 广播按区域过滤、admin 师傅管理审计列、旧凭证支付语义收敛**

---

## 1. 背景与目标

home_app 当前订单交易闭环**已端到端跑通**：后端订单/支付/结算接口齐全，三端（用户 / 师傅 / 管理）下单、接单池、订单列表/详情、结算台账、师傅收入页面均已实现并在浏览器验证。本文档承载下单接单流程的业务要领与进度台账，后续改动请同步更新。

**本次重大设计变更（2026-08-13）**：原模型「下单→接单→服务→完成→支付→评价」改为
**「下单即支付（待支付）→ 支付成功（平台担保托管）→ 待接单 → 接单 → 服务中 → 待验收 → 客户验收（释放托管金）→ 评价」**。
支付前置的理由：资金在派单前锁定进平台托管，师傅完成服务、客户验收后平台才把托管金释放给师傅；任何支付后阶段取消都走退款，仅「待支付」阶段取消无退款。

关联文档：
- 权限/角色设计：`docs/rbac-design.md`
- 地域闸门（服务区域）：P0+P1 已接线（下单校验开通区域、抢单按「所在地 ∪ 接单范围」并集过滤、师傅配置白名单约束，2026-08-20）；剩余 P2 WS 广播按区域过滤 + P3 admin 审计列（见 HANDOFF.md 第 10 节）

---

## 2. 业务要领

### 2.1 订单状态机（白名单，定义在 `@laoma/shared`）

状态流转由 `ORDER_STATUS_FLOW`（`shared/src/types.ts:73-87`）强约束；`orders.service` 的 `transition()` 在每次变更前调用 `canTransition()` 校验，非法流转直接 400。

```
下单 create
   │
   ▼
PendingPayment(待支付) ──charge──▶ [支付成功：平台托管] ──▶ PendingAccept(待接单)
   │                                          │                       │
   │ cancel(支付前)                            │ cancel(支付后)         │ grab/assign
   ▼                                          ▼                       ▼
Cancelled(已取消,终态,无退款)        Refunding(退款中)          Accepted(已接单)
                                          │                       │
                                          │ refund                │ depart(师傅出发)
                                          ▼                       ▼
                                       Refunded(已退款,终态)   Departing(出发上门中)
                                                                      │
                                                                      │ arrive(客户验证码)
                                                                      ▼
                                                                Arrived(已到达)
                                                                      │
                                                                      │ start
                                                                      ▼
                                                                Servicing(服务中)
                                                                      │
                                                                      │ complete
                                                                      ▼
                                                                PendingConfirm(待验收)
                                                                      │
                                              cancel ───────────────┤
                                              (支付后)              │ confirm(客户验收)
                                                                      ▼
                                                                Reviewed(已完成,托管金已释放)
                                                                      │
                                                                      │ review(评价)
                                                                      ▼
                                                                Evaluated(已评价,终态)

终态：Evaluated、Refunded、Cancelled（无出边）
```

| 状态 | 含义 | 进入动作 | 触发角色 |
|---|---|---|---|
| `pending_payment` | 待支付（下单后初始态） | create 下单 | 用户 |
| `pending_accept` | 待接单（已支付，资金进入平台托管） | 支付成功回调 `applyPaid` | 系统（支付回调） |
| `accepted` | 已接单 | grab 抢单 / assign 指派 | 师傅 / 管理员 |
| `departing` | 出发上门中（师傅已出发，前往客户地址） | depart 出发 | 师傅 |
| `arrived` | 已到达（师傅到达现场，客户验证码确认） | arrive 到达（校验 generate-arrive-code 生成的码） | 师傅（用户出码） |
| `servicing` | 服务中 | start 开始服务 | 师傅 |
| `pending_confirm` | 待验收 | complete 完成服务 | 师傅 |
| `reviewed` | 已完成（客户已验收、托管金已释放，待客户评价） | confirm 客户验收 | 用户 |
| `evaluated` | 已评价（终态，纯展示标记，不涉及资金） | review 评价（`Reviewed→Evaluated`） | 用户 |
| `refunding` | 退款中 | cancel（支付后） | 用户 / 师傅 / 管理员 |
| `refunded` | 已退款（终态） | refund 退款完成 | 系统（退款回调） |
| `cancelled` | 已取消（仅支付前取消，无退款，终态） | cancel（支付前） | 用户 / 师傅 / 管理员 |

> ✅ **双入口已收口（2026-08-13）**：资金释放唯一入口收敛到 `confirm()`（`PendingConfirm→Reviewed` + `releaseToMaster`）。`reviews.create` 仅当 `order.status===Reviewed` 才允许评价，且不再自行改订单状态——评价只走状态机 `Reviewed→Evaluated`（`reviews.service.ts:36-37` 校验）。

### 2.2 角色与职责

| 角色 | 核心能力 | 对应端点 |
|---|---|---|
| **Customer（用户）** | 下单、查我的订单、发起支付(charge)、模拟支付成功回调(mock/notify)、生成到达码、取消、验收确认(confirm)、退款(refund)、评价 | `POST /orders`、`GET /orders/mine`、`POST /payments/charge`、`POST /payments/mock/notify`、`POST /orders/:id/generate-arrive-code`、`POST /orders/:id/cancel`、`POST /orders/:id/confirm`、`POST /payments/refund`、`POST /reviews` |
| **Master（师傅）** | 抢单、查接单池、出发、到达（验码）、开始/完成服务、查我的订单、取消 | `GET /orders/pool`、`POST /:id/grab`、`POST /:id/depart`、`POST /:id/arrive`、`POST /:id/start`、`POST /:id/complete`、`GET /orders/master`、`POST /:id/cancel` |
| **Admin（管理员）** | 指派订单、查全部订单、取消、审核补偿结算单、配置支付商户信息 | `POST /:id/assign`（需 `orders:edit`）、`GET /orders/all`、`POST /:id/cancel`、`POST /payments/:id/confirm`、`GET/PUT /payments/config` |

### 2.3 核心端点清单（已实现于 `nest/src/orders` 与 `nest/src/payments`）

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| POST | `/orders` | Customer | 下单；`status=PendingPayment`（待支付，支付前置）；`serviceSnapshot` + `commissionSnapshot` 双快照、`city=addr.city`、`amount=item.price`；地域闸门校验开通区域 |
| GET | `/orders/mine` | Customer | 我的订单（含 serviceItem / master） |
| GET | `/orders/pool` | Master（**已加鉴权 + 地域过滤**） | 抢单池，按「所在地 ∪ 接单范围」并集过滤 `PendingAccept && masterId:null`（仅支付成功入池） |
| GET | `/orders/master?city=` | Master | 师傅视角订单（含客户手机号/昵称/本单评价） |
| GET | `/orders/all` | Admin | 全部订单（后台台账基础） |
| POST | `/orders/:id/grab` | Master | 抢单：`updateMany` 原子抢占（`status=PendingAccept && masterId:null`，count=0 即已被接走）+ 转 `Accepted` |
| POST | `/orders/:id/assign` | Admin | 指派：`orders:edit` 权限 + 审计 |
| POST | `/orders/:id/depart` | Master | 师傅出发，转 `Departing`（越权校验 `masterId === mid`） |
| POST | `/orders/:id/generate-arrive-code` | Customer | 客户生成到达码（本人订单） |
| POST | `/orders/:id/arrive` | Master | 师傅到达验码，转 `Arrived` |
| POST | `/orders/:id/start` | Master | 转 `Servicing`（越权校验） |
| POST | `/orders/:id/complete` | Master | 转 `PendingConfirm`（越权校验） |
| POST | `/orders/:id/confirm` | Customer | **客户验收**：`PendingConfirm→Reviewed` + 释放托管金 `releaseToMaster`（资金释放唯一入口） |
| POST | `/orders/:id/cancel` | 登录用户 | 支付前→`Cancelled`（无退款）；支付后→`Refunding`+调 `payments.refund`（阶梯退款，见 2.4-8）；支持 reason 参数、admin 可代取消 |
| POST | `/payments/charge` | Customer | 发起支付：仅 `PendingPayment` 可发起；建支付单，返回 `payParams` |
| POST | `/payments/mock/notify` | Customer | 模拟支付成功回调：`{orderId, token}`，等价于真实通道异步 notify |
| POST | `/payments/notify/wechat` `/notify/alipay` | 公开 | 真实通道异步回调，走统一 `handleNotify→applyPaid`（待真实凭证 + 公网回调联调） |
| POST | `/payments/refund` | Customer | 退款：仅支付后托管阶段可退；调 provider.refund + 阶梯分账 + 走状态机置 `Refunded` |
| POST | `/payments/:id/confirm` | Admin | 补偿结算单审核确认入账（退款留成中师傅补偿部分） |
| GET | `/payments/config` | Admin | 读商户配置（脱敏，不回显明文密钥） |
| PUT | `/payments/config` | Admin | 保存商户配置（敏感字段 AES-256-GCM 加密落盘） |
| POST | `/reviews` | Customer | 评价；前提 `order.status===Reviewed`（验收后才可评，评后转 `Evaluated`） |

### 2.4 关键业务约束

1. **支付前置（核心变更）**：`create` 落 `status=PendingPayment`；订单**必须支付成功（平台托管）才进入 `PendingAccept` 抢单池**。未支付订单永不出现在接单池。
2. **平台担保托管 + 分账**：`applyPaid()`（`payments.service.ts:143`）把订单 `PendingPayment→PendingAccept`、支付单置 `paid`，资金视为进入平台托管；直到客户 `confirm` 验收才经 `settlements.releaseToMaster` 生成常规结算单（`type=normal`，即时入账 `credited`）。平台留成按分账规则引擎（`CommissionRule`）在退款/结算时拆分，不再「全额给师傅」（见下条）。
3. **快照隔离（双快照）**：`create` 时 `serviceSnapshot: item`（服务项整行）+ `commissionSnapshot`（分账规则快照，按 服务项→类目树→全局 三级解析并固化）写入订单（R-新4），后续改价/调佣金不影响历史订单。
4. **地域跟随订单 + 地域闸门**：`city = addr.city`（取自用户收货地址），服务项本身不绑区域；地域闸门（ServiceArea）已接入 `create()` 校验（P0）+ `pool()`/`grab()` 按「所在地 ∪ 接单范围」并集过滤（P1），2026-08-20（详见 HANDOFF.md 第 10 节）。
5. **抢单 / 派单双模式并存**：师傅 `grab`（原子抢占）或管理员 `assign`，都到 `Accepted`。
6. **PaymentProvider 接缝（可插拔支付通道）**：`payments/provider.ts` 定义 `PaymentProvider` 接口（createCharge / verifyNotify / refund）；order 侧只依赖接口，后期微信/支付宝只需新增实现类 + admin 配置切换，业务零改动。`getProvider()` 现按 `MerchantConfig` 切换（`enabled && provider!=='mock'` 时返回 Wechat/Alipay 实现，否则恒 mock）。
7. **Mock 走「异步回调」范式**：`MockPaymentProvider.createCharge` 返回 `payParams:{type:'mock',token:tradeNo}`；前端点「模拟支付」后调 `POST /payments/mock/notify` 携带 `token`，经 `verifyNotify` 校验后 `applyPaid`。**该回调路径与真实通道 notify 完全一致**，保证后期换真通道仅配置切换、代码零改动。
8. **阶梯退款**：支付后任意阶段取消 → `Refunding` → 调 `payments.refund` → 按 `commissionSnapshot` 的 `refundPolicy` 分档（默认：`departing` 退 80% / `arrived` 退 50% / 其余全额），平台留成 + 师傅补偿拆分写日志；`masterCompensation>0` 时生成补偿结算单（`type=compensation`，`pending`，待 admin `POST /payments/:id/confirm` 审核入账）；最后**统一走状态机** `→Refunded`（`action='refund'` 写 orderLog）。仅 `PendingPayment` 阶段取消 = `Cancelled`（无退款）。
9. **审计轨迹**：`transition()` 每次写 `orderLog`；`applyPaid`/`refund` 也各写一条 orderLog（action=pay/refund）。
10. **商户密钥不落前端**：`MerchantConfigStore`（`merchant-config.store.ts`）对 `appSecret/apiKey/certContent` 做 AES-256-GCM 加密落盘 `config/merchant.json`；`getConfig()` 回显脱敏副本（删敏感字段），前端绝不回显明文。
11. **实时推送（WS 网关已挂载）**：`create`/`transition`/`applyPaid` 经 `gateway?.broadcast...` 推 `new-order`（`to('pool')`）/`order-update`（`to('order:<id>')`）；网关已挂入 `app.module`（`orders.module`/`payments.module` 均 import），JWT 鉴权 + 房间订阅（`subscribe-order`/`unsubscribe-order`/`join-pool`/`leave-pool`）。**剩余 P2：pool 广播未按区域过滤**。

---

## 3. 当前进度

### 3.1 后端已具备 ✅

- `OrdersModule` 重写：构造器注入 `SettlementsService` + `PaymentsService` + `CommissionService`（可选 `gateway` 置末，避开 TS1016）；`create→PendingPayment`、`confirm`（验收+释放金）、`cancel`（支付前/后分流退款）、`depart/arrive`（出发/到达验码）、`start/complete` 加 `masterId` 越权校验。
- `PaymentsModule` 接缝骨架：`provider.ts`（接口）+ `mock.provider.ts` + `wechat.provider.ts`/`alipay.provider.ts`（原生 crypto 实现）+ `merchant-config.store.ts`（AES 加密存储）+ `payments.service.ts`（charge / mockNotify / handleNotify / applyPaid / refund / 旧 qr 凭证支付并存）+ `payments.controller.ts`（charge / mock/notify / notify/wechat|alipay / refund / config GET+PUT / 旧凭证支付 + 补偿单审核 confirm）。
- 状态机 `ORDER_STATUS_FLOW` 已扩展为支付前置+托管模型（`shared/src/types.ts:73-87`）：`PendingConfirm/Reviewed/Evaluated/Refunding/Refunded/Cancelled/Departing/Arrived` 及 `PaymentStatus.Refunded` 已入 `schema.prisma` 枚举。
- `SettlementsService`：`releaseToMaster(orderId)` 幂等生成常规结算单（验收后即时入账）；`createCompensation` 生成退款补偿单（pending，待 admin 审核）；`syncForPaidOrders` 兜底同步。
- `ReviewsService` 评价门槛收敛为 `order.status===Reviewed`（验收后才可评，评后走状态机转 `Evaluated`，不再自行改状态）。
- `GET /orders/pool` 已加 `@UseGuards(JwtAuthGuard) @Roles(Role.Master)`（原 P1 无鉴权缺口已修）+ 地域并集过滤（P1）。
- **分账规则引擎（2026-08-19）**：`CommissionModule`，`CommissionRule`（scope+refId 唯一，platformRate/refundPolicy/refundTiers），下单时 `resolve()` 三级降级解析并快照，退款走 `splitRefund` 阶梯拆分。
- 前端：`admin-api.ts`/`orders-api.ts` 全量 API 封装；`admin/settings/payment/page.tsx` 支付配置页（provider 选择 + 真实通道开关 + 密钥加密存储 + 商户锁定）；`query-keys.ts`/`admin-menu.ts` 配套。双端 `pnpm typecheck` 均 0 错。

### 3.2 前端页面 ✅（三端订单闭环已建齐）

| 端 | 已建页面 | 对应端点 |
|---|---|---|
| **client** | 下单页 `orders/new`、订单列表 `orders`、订单详情 `orders/[id]`（charge / 模拟支付 / cancel / confirm / 评价） | `POST /orders`、`GET /mine`、`charge`、`mock/notify`、`cancel`、`confirm`、`generate-arrive-code`、`POST /reviews` |
| **master** | 接单池 `orders/pool`（轮询 + WS 实时）、我的订单 `orders/mine`、订单详情 `orders/[id]`（grab / depart / arrive / start / complete）、收入台账 `me/income`（含明细 `income/details`） | `GET /pool`、`grab`、`depart`、`arrive`、`start`、`complete`、`GET /master` |
| **admin** | 订单台账 `orders/all`（assign/cancel）、`orders/active`、`orders/pending`、订单详情 `orders/[id]`、结算台账 `settlements`（含补偿单审核）、支付配置 `settings/payment` | `GET /all`、`assign`、`cancel`、`GET/PUT /payments/config`、`POST /payments/:id/confirm` |
| 三端 | WebSocket 客户端（`subscribe-order`/`join-pool`，JWT 鉴权 + 房间定向） | gateway（已挂载） |

### 3.3 已知缺口与风险（BUG 清单，带优先级）

| 优先级 | 问题 | 位置 | 影响 | 修复方向 |
|---|---|---|---|---|
| ~~**P0**~~ ✅ | WS 网关未挂入 `app.module` | `nest/src/app.module.ts` 缺 `GatewayModule` | `gateway` 注入 undefined，`broadcast*` 静默跳过 → 推送恒失效 | **已修（2026-08-13）**：`app.module` + `orders.module` + `payments.module` 均 import `GatewayModule`；`PaymentsService` 注入 `OrdersGateway`，`applyPaid` 支付成功即 `broadcastNewOrder`（师傅端接单池即时可见）；`OrdersService.transition` 状态变更 `broadcastOrderUpdate` 均已生效 |
| ~~**P0**~~ ✅ | 验收/评价双入口冲突 | `orders.service.confirm` + `reviews.service.create` | `reviews.create` 直置 `Reviewed` 会绕过 `confirm`、不释放托管金 | **已修（2026-08-13）**：`reviews.create` 改为**仅当 `order.status===Reviewed`（已确认验收）才允许评价**，且不再自行改订单状态；资金释放唯一入口收敛到 `confirm()` |
| ~~**P1**~~ ✅ | `grab` 并发无防 | `orders.service.ts:155` | 同单被多师傅同时抢 | **已修（2026-08-13）**：`grab` 改用 `updateMany({where:{id,status:PendingAccept,masterId:null},data:{masterId:mid}})`，count=0 即「已被接走」原子抢占 |
| ~~**P1**~~ ✅ | 真实支付 Provider + 按配置切换 | `payments/wechat.provider.ts` `alipay.provider.ts` `getProvider` | 原恒返回 mock，真实通道未实现/未接线 | **已修（2026-08-13）**：新增 `WechatPaymentProvider`/`AlipayPaymentProvider`（原生 crypto，V3 签名 / 回调解密 / 退款）；`getProvider()` 读 `MerchantConfig`，`enabled && provider!=='mock'` 时返回对应实现；`controller` 新增公开 `POST /notify/wechat`、`/notify/alipay` 走统一 `handleNotify→applyPaid`（待真实凭证 + 公网回调联调） |
| ~~**P2**~~ ✅ | `Refunding→Refunded` 绕过 transition | `payments.service.ts refund` | 原直接 `order.update({status:Refunded})`，不写 orderLog、不走统一入口 | **已修（2026-08-19）**：退款改走 `orders.transition` 两段式（非 Refunding 先转 Refunding 再转 Refunded），统一 orderLog（action='refund'）+ 实时广播；顺带接入阶梯分账与补偿单生成 |
| ~~**P2**~~ ✅ | 地域接 `ServiceArea`（P0+P1） | `orders.service.ts create()/pool()/grab()` + `masters.service.ts updateMe()` | **已修（2026-08-20）**：下单校验开通区域、抢单池按「所在地 ∪ 接单范围」并集过滤；剩余 P2 WS 广播按区域过滤 + P3 admin 审计列（见 HANDOFF.md 第 10 节） |
| **P2** | 旧二维码凭证支付与前置支付并存 | `payments.controller.ts` 旧 `POST /payments` | 两套支付入口并存，语义需收敛（凭证支付属线下/对公场景，可保留但需在文档/UI 区分） | 明确两通道适用场景，避免用户混淆 |

---

## 4. 下一步待办（按优先级）

- [x] **P0-1** 挂 `GatewayModule`：`app.module.ts` + `orders.module.ts` + `payments.module.ts` 均已 import（重启 3721 生效）；`applyPaid` 支付成功即 `broadcastNewOrder`，师傅端接单池即时可见。
- [x] **P0-2** 收口验收/评价双入口：`reviews.create` 仅当 `order.status===Reviewed` 才允许，且不再改订单状态；资金释放唯一入口收敛到 `confirm()`。
- [x] **P1-1** `grab` 并发防：`updateMany` 原子抢占（`where:{id,status:PendingAccept,masterId:null}`），count=0 即「已被接走」。
- [x] **P1-2** 真实支付 Provider：新增 `wechat.provider.ts`/`alipay.provider.ts`（原生 crypto 实现 `PaymentProvider` 三方法）+ `getProvider()` 按 `MerchantConfig` 切换；`controller` 新增公开 `POST /notify/wechat`、`/notify/alipay` 走统一 `handleNotify→applyPaid`（待真实凭证 + 公网回调联调）。
- [x] **前端 Phase1（最小闭环，已全量落地）**：
  - [x] client 下单页（`POST /orders`）+ 订单详情（charge / 模拟支付 / cancel / confirm / 评价 / 到达码）
  - [x] master 接单池页（`GET /pool`，socket.io-client 匹配后端 `/ws`，JWT 鉴权 + 房间定向 `order:<id>`/`pool`）+ grab + 订单详情（depart / arrive / start / complete）
  - [x] admin 订单台账页（`GET /all` + assign / cancel）+ 结算台账页（`settlements` 常规单 + 补偿单审核 `POST /payments/:id/confirm`）+ 师傅收入页（`me/income`）
  - [x] 支付配置页（provider 选择 + 密钥加密存储 + 商户锁定；后端真通道接缝已接线，待真实商户凭证 + 公网回调地址（`WX_MCH_SERIAL`/`WX_NOTIFY_URL`/`ALIPAY_NOTIFY_URL`）联调）
- [x] **三端 WS 客户端**：按订阅改造已落地（JWT 鉴权 + 房间定向 `order:<id>`/`pool`，2026-08-19；详见 HANDOFF.md 第 14 节）
- [ ] **P2/P3 收尾**：WS 广播按区域过滤、admin 师傅管理 serviceAreas 审计列、旧凭证支付语义收敛、阶梯退款真实渠道验证（wechat/alipay provider refund 待真实凭证联调）。

---

## 5. 验收用例（浏览器跑通闭环）

> 以下用例用于判定「下单接单流程（支付前置+托管）」已端到端打通。

1. **下单 → 支付 → 入池**：用户 A 下单（服务项 + 地址 city=广州）→ 状态 `pending_payment`；A 调 `charge` 拿 `payParams.token` → 调 `mock/notify` → `applyPaid` → 状态 `pending_accept`，**接单池可见**（WS 实时 + 地域并集过滤）。
2. **接单 → 出发 → 到达 → 服务 → 完成**：师傅 B `grab` → `accepted`；B `depart` → `departing`；A 生成到达码，B `arrive` 验码 → `arrived`；B `start` → `servicing`；B `complete` → `pending_confirm`。
3. **验收 → 释放金 → 评价**：A `confirm` → `reviewed` + 常规结算单生成（`settlements` 出现该单 `type=normal, status=credited`，即时入账）；A 评价 → `evaluated`（终态）。
4. **支付后取消 → 阶梯退款**：在 `pending_accept/accepted/departing/arrived/servicing/pending_confirm` 任一阶段 `cancel` → `refunding` → 调 refund → 按阶段分档（departing 80% / arrived 50% / 其余全额）→ 走状态机 `refunded`，支付单置 `refunded`；有师傅补偿时生成 `type=compensation, status=pending` 补偿单，admin 审核 `POST /payments/:id/confirm` 后入账。
5. **支付前取消 → 无退款**：在 `pending_payment` 阶段 `cancel` → `cancelled`，无退款、支付单保持 `pending`。
6. **实时性**：A 支付成功入池后，B 端 WS **立即**收到 `new-order`（pool 房间）；B `grab` 后 A 端**立即**收到 `order-update`（order:<id> 房间）。
7. **归属校验（越权回归）**：B 尝试 `start`/`complete`/`arrive`/`depart` 非自己接的单 → 403；C 尝试 `charge`/`confirm` 别人订单 → 拒绝（验证 `order.customerId/m.masterId === 当前用户`）。
8. **双入口收口验证（已收口）**：A 在 `pending_confirm` 状态下**先评价** → 被拒（`请先在订单中确认验收，再评价`）；`confirm` 后再评价成功。资金释放只走 `confirm()` 唯一入口。

---

## 6. 附录：关键代码索引

| 关注点 | 文件 |
|---|---|
| 状态机定义 | `shared/src/types.ts`（`ORDER_STATUS_FLOW`，L73-87；`OrderStatus` 枚举 L9-22，含 Departing/Arrived/Evaluated） |
| 状态校验 | `nest/src/orders/order-status.ts`（`canTransition`） |
| 订单业务 | `nest/src/orders/orders.service.ts`（create L61 / pool L174 / grab L263 / assign L289 / depart L303 / generateArriveCode L312 / arrive L328 / startService L354 / complete L362 / confirm L376 / cancel L394） |
| 订单端点 | `nest/src/orders/orders.controller.ts`（含 depart / generate-arrive-code / arrive） |
| 地域匹配工具 | `nest/src/common/region-match.ts`（`regionMatches` / `serviceAreasToRules`） |
| 分账规则引擎 | `nest/src/commission/`（`CommissionRule` 三级降级解析 + `resolveTierRatio` 区间断点 + `splitRefund` 阶梯拆分） |
| 支付接缝接口 | `nest/src/payments/provider.ts`（`PaymentProvider` 接口） |
| Mock 通道 | `nest/src/payments/mock.provider.ts` |
| 真实通道 | `nest/src/payments/wechat.provider.ts` / `alipay.provider.ts`（原生 crypto，V3 签名/回调解密/退款） |
| 商户配置加密存储 | `nest/src/payments/merchant-config.store.ts`（AES-256-GCM） |
| 支付业务 | `nest/src/payments/payments.service.ts`（charge L104 / mockNotify L127 / handleNotify L135 / applyPaid L143 / refund L175） |
| 支付端点 | `nest/src/payments/payments.controller.ts`（charge / mock/notify / notify/wechat\|alipay / refund / config GET+PUT / 旧凭证支付 + 补偿单审核 `:id/confirm`） |
| 托管金释放 + 补偿单 | `nest/src/settlements/settlements.service.ts`（byOrder L30 / syncForPaidOrders L70 / releaseToMaster L142 / createCompensation L173） |
| 评价门槛 | `nest/src/reviews/reviews.service.ts`（`order.status===Reviewed` 校验 L36-37，评后状态机转 Evaluated） |
| 网关挂载点 | `nest/src/app.module.ts`（已 import `GatewayModule`；`orders.module`/`payments.module` 均挂载） |
| 网关订阅 | `nest/src/gateway/orders.gateway.ts`（subscribe-order / join-pool / broadcastNewOrder / broadcastOrderUpdate / admin-dashboard） |
| 前端订单 API | `next/src/lib/orders-api.ts`（订单/结算/提现/分账 API 调用） |
| 前端支付配置页 | `next/src/app/admin/settings/payment/page.tsx` |
| 前端支付 API | `next/src/lib/admin-api.ts`（`getPaymentConfig` / `savePaymentConfig`） |
| 前端三端订单页 | `next/src/app/client/orders/**`、`next/src/app/master/orders/**`、`next/src/app/admin/orders/**`（均已建） |
| 结算台账 | `next/src/app/admin/settlements/page.tsx`；师傅收入 `next/src/app/master/me/income/**` |
