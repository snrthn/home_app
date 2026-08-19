# 下单接单流程 SOP（home_app）

> 文档定位：下单 / 接单 / 服务 / 支付 / 验收 / 退款 这一核心交易闭环的业务要领与进度台账。
> 维护方式：本文件随 SOP 推进持续更新；状态变更请同步记一笔（日期 + 结论）。
> 创建：2026-08-13
> 最近改写：2026-08-13 **支付前置 + 平台担保托管模型落地（三件套之文档件）**
> 当前状态：**后端支付前置+托管接缝骨架就绪、前端三端订单页全缺、网关与一条验收/评价双入口冲突待收口**

---

## 1. 背景与目标

home_app 当前卡在「后端 API → 前端页面」断层：后端订单 SOP 接口层已较完整，但三端（用户 / 师傅 / 管理）**下单、接单池、订单列表/详情、结算台账页面全部缺失**，闭环从未在浏览器跑通。本文档单独承载下单接单流程的进度与业务要领，便于后续 Phase1 前端开发对照。

**本次重大设计变更（2026-08-13）**：原模型「下单→接单→服务→完成→支付→评价」改为
**「下单即支付（待支付）→ 支付成功（平台担保托管）→ 待接单 → 接单 → 服务中 → 待验收 → 客户验收（释放托管金）→ 评价」**。
支付前置的理由：资金在派单前锁定进平台托管，师傅完成服务、客户验收后平台才把托管金释放给师傅；任何支付后阶段取消都走退款，仅「待支付」阶段取消无退款。

关联文档：
- 权限/角色设计：`docs/rbac-design.md`
- 地域闸门（服务区域）：P0+P1 已接线（下单校验开通区域、抢单二次校验、师傅配置白名单约束，2026-08-20）；剩余 P2 WS 广播按区域过滤 + P3 admin 审计列（见 HANDOFF.md 第 15 节）

---

## 2. 业务要领

### 2.1 订单状态机（白名单，定义在 `@laoma/shared`）

状态流转由 `ORDER_STATUS_FLOW`（`shared/src/types.ts:52-62`）强约束；`orders.service` 的 `transition()`（`nest/src/orders/orders.service.ts:125-153`）在每次变更前调用 `canTransition()` 校验，非法流转直接 400。

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
                                          │ refund                │ start
                                          ▼                       ▼
                                       Refunded(已退款,终态)   Servicing(服务中)
                                                                  │
                                                                  │ complete
                                                                  ▼
                                                            PendingConfirm(待验收)
                                                                  │
                                              cancel ────────────┤
                                              (支付后)            │ confirm(客户验收)
                                                                  ▼
                                                            Reviewed(已评价,终态)
                                                                  └─ 托管金释放给师傅(settlements.releaseToMaster)

终态：Reviewed、Refunded、Cancelled（无出边）
```

| 状态 | 含义 | 进入动作 | 触发角色 |
|---|---|---|---|
| `pending_payment` | 待支付（下单后初始态） | create 下单 | 用户 |
| `pending_accept` | 待接单（已支付，资金进入平台托管） | 支付成功回调 `applyPaid` | 系统（支付回调） |
| `accepted` | 已接单 | grab 抢单 / assign 指派 | 师傅 / 管理员 |
| `servicing` | 服务中 | start 开始服务 | 师傅 |
| `pending_confirm` | 待验收 | complete 完成服务 | 师傅 |
| `reviewed` | 已评价（终态，托管金已释放） | confirm 客户验收 | 用户 |
| `refunding` | 退款中 | cancel（支付后） | 用户 / 师傅 / 管理员 |
| `refunded` | 已退款（终态） | refund 退款完成 | 系统（退款回调） |
| `cancelled` | 已取消（仅支付前取消，无退款，终态） | cancel（支付前） | 用户 / 师傅 / 管理员 |

> ⚠️ **状态机入口变更**：`reviewed` 的合法入口现在是 `confirm()`（订单模块，`PendingConfirm→Reviewed` + 释放托管金），而非评价模块直接置位。评价模块 `reviews.service.ts:63-66` 仍保留「评价即置 Reviewed」的直接 `order.update`，与 `confirm()` 形成**双入口**（见 4.3 冲突项，待收口）。

### 2.2 角色与职责

| 角色 | 核心能力 | 对应端点 |
|---|---|---|
| **Customer（用户）** | 下单、查我的订单、发起支付(charge)、模拟支付成功回调(mock/notify)、取消、验收确认(confirm)、退款(refund)、评价 | `POST /orders`、`GET /orders/mine`、`POST /payments/charge`、`POST /payments/mock/notify`、`POST /orders/:id/cancel`、`POST /orders/:id/confirm`、`POST /payments/refund`、`POST /reviews` |
| **Master（师傅）** | 抢单、查接单池、开始/完成服务、查我的订单、取消 | `GET /orders/pool`、`POST /:id/grab`、`POST /:id/start`、`POST /:id/complete`、`GET /orders/master`、`POST /:id/cancel` |
| **Admin（管理员）** | 指派订单、查全部订单、取消、配置支付商户信息 | `POST /:id/assign`（需 `orders:edit`）、`GET /orders/all`、`POST /:id/cancel`、`GET /payments/config`、`PUT /payments/config` |

### 2.3 核心端点清单（已实现于 `nest/src/orders` 与 `nest/src/payments`）

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| POST | `/orders` | Customer | 下单；`status=PendingPayment`（待支付，支付前置）；`serviceSnapshot` 快照、`city=addr.city`、`amount=item.price` |
| GET | `/orders/mine` | Customer | 我的订单（含 serviceItem / master） |
| GET | `/orders/pool?city=` | Master（**已加鉴权**） | 抢单池，按 city 过滤 `PendingAccept`（仅支付成功入池） |
| GET | `/orders/master?city=` | Master | 师傅视角订单 |
| GET | `/orders/all` | Admin | 全部订单（后台台账基础） |
| POST | `/orders/:id/grab` | Master | 抢单：设 `masterId` + 转 `Accepted`（**无并发防，见 4.3**） |
| POST | `/orders/:id/assign` | Admin | 指派：`orders:edit` 权限 + 审计 |
| POST | `/orders/:id/start` | Master | 转 `Servicing`（越权校验 `masterId === mid`） |
| POST | `/orders/:id/complete` | Master | 转 `PendingConfirm`（越权校验） |
| POST | `/orders/:id/confirm` | Customer | **客户验收**：`PendingConfirm→Reviewed` + 释放托管金 `releaseToMaster`（新增，替代旧「评价即终态」） |
| POST | `/orders/:id/cancel` | 登录用户 | 支付前→`Cancelled`（无退款）；支付后→`Refunding`+调 `payments.refund`（退款后→`Refunded`） |
| POST | `/payments/charge` | Customer | 发起支付：仅 `PendingPayment` 可发起；建支付单，返回 `payParams` |
| POST | `/payments/mock/notify` | Customer | 模拟支付成功回调：`{orderId, token}`，等价于真实通道异步 notify |
| POST | `/payments/refund` | Customer | 退款：仅 POST_PAY_STATES 可退；调 provider.refund，置 `Refunded` |
| GET | `/payments/config` | Admin | 读商户配置（脱敏，不回显明文密钥） |
| PUT | `/payments/config` | Admin | 保存商户配置（敏感字段 AES-256-GCM 加密落盘） |
| POST | `/reviews` | Customer | 评价；前提校验 `paidStates`（支付后及之后才允许） |

### 2.4 关键业务约束

1. **支付前置（核心变更）**：`create` 落 `status=PendingPayment`；订单**必须支付成功（平台托管）才进入 `PendingAccept` 抢单池**。未支付订单永不出现在接单池。
2. **平台担保托管**：`applyPaid()`（`payments.service.ts:120-143`）把订单 `PendingPayment→PendingAccept`、支付单置 `paid`，资金视为进入平台托管；直到客户 `confirm` 验收才经 `settlements.releaseToMaster` 生成结算台账（全额给师傅，平台不参与分账）。
3. **价格快照隔离**：`create` 时 `serviceSnapshot: item as any` 把服务项整行快照进订单（R-新4），后续改价不影响历史订单。
4. **地域跟随订单**：`city = addr.city`（取自用户收货地址），服务项本身不绑区域；地域闸门（ServiceArea）已接入 `create()` 校验（P0，2026-08-20，详见 HANDOFF.md 第 15 节）。
5. **抢单 / 派单双模式并存**：师傅 `grab` 或管理员 `assign`，都到 `Accepted`。
6. **PaymentProvider 接缝（可插拔支付通道）**：`payments/provider.ts` 定义 `PaymentProvider` 接口（createCharge / verifyNotify / refund）；order 侧只依赖接口，后期微信/支付宝只需新增实现类 + admin 配置切换，业务零改动。`getProvider()` 现恒返回 `MockPaymentProvider`（`payments.service.ts:31-34`，预留 TODO 按 `MerchantConfig` 切换）。
7. **Mock 走「异步回调」范式**：`MockPaymentProvider.createCharge` 返回 `payParams:{type:'mock',token:tradeNo}`；前端点「模拟支付」后调 `POST /payments/mock/notify` 携带 `token`，经 `verifyNotify` 校验后 `applyPaid`。**该回调路径与真实通道 notify 完全一致**，保证后期换真通道仅配置切换、代码零改动。
8. **退款路径**：支付后任意阶段取消 → `Refunding` → 调 `payments.refund` → 支付单置 `refunded`、订单置 `Refunded`。仅 `PendingPayment` 阶段取消 = `Cancelled`（无退款）。
9. **审计轨迹**：`transition()` 每次写 `orderLog`；`applyPaid`/`refund` 也各写一条 orderLog（action=pay/refund）。
10. **商户密钥不落前端**：`MerchantConfigStore`（`merchant-config.store.ts`）对 `appSecret/apiKey/certContent` 做 AES-256-GCM 加密落盘 `config/merchant.json`；`getConfig()` 回显脱敏副本（删敏感字段），前端绝不回显明文。
11. **实时推送（依赖 WS 网关）**：`create`/`transition`/`applyPaid` 经 `gateway?.broadcast...` 推 `order-update`；订单入池（applyPaid）后师傅端应即时可见。**当前网关未挂载 → 推送恒失效，`applyPaid` 内已留 TODO（见 4.3 P0）**。

---

## 3. 当前进度

### 3.1 后端已具备 ✅

- `OrdersModule` 重写：构造器注入 `SettlementsService` + `PaymentsService`（可选 `gateway` 置末，避开 TS1016）；`create→PendingPayment`、`confirm`（验收+释放金）、`cancel`（支付前/后分流退款）齐备；`start/complete` 加 `masterId` 越权校验。
- `PaymentsModule` 接缝骨架：`provider.ts`（接口）+ `mock.provider.ts`（mock 实现）+ `merchant-config.store.ts`（AES 加密存储）+ `payments.service.ts`（charge / mockNotify / handleNotify / applyPaid / refund / 旧 qr 凭证支付并存）+ `payments.controller.ts`（charge / mock/notify / refund / config GET+PUT / 旧凭证支付）。
- 状态机 `ORDER_STATUS_FLOW` 已扩展为支付前置+托管模型（`shared/src/types.ts`）；`PendingConfirm/Reviewed/Refunding/Refunded/Cancelled` 及 `PaymentStatus.Refunded` 已入 `schema.prisma` 枚举。
- `SettlementsService.releaseToMaster(orderId)` 幂等生成结算台账（验收后释放托管金）。
- `ReviewsService` 评价门槛改为 `paidStates`（支付后及之后才可评）。
- `GET /orders/pool` 已加 `@UseGuards(JwtAuthGuard) @Roles(Role.Master)`（原 P1 无鉴权缺口已修）。
- 前端：`admin-api.ts` 增 `getPaymentConfig/savePaymentConfig`；`admin/settings/payment/page.tsx` 支付配置页骨架（provider 选择 + 启用真实通道开关 + 密钥输入，mock/未启用时禁用）；`query-keys.ts` 增 `paymentConfig`；`admin-menu.ts` 增「支付配置」菜单（无 perm，恒可见）。双端 `pnpm typecheck` 均 0 错。

### 3.2 前端缺失页面 ❌（三端均无 `orders` 目录）

| 端 | 缺的页面 | 需对接端点 |
|---|---|---|
| **client** | 下单页（选服务项/地址/预约时间）、订单列表、订单详情（charge / 模拟支付 / cancel / confirm）、评价页 | `POST /orders`、`GET /mine`、`charge`、`mock/notify`、`cancel`、`confirm`、`POST /reviews` |
| **master** | 接单池页（轮询或 WS）、订单详情（start/complete）、我的订单 | `GET /pool`、`grab`、`start`、`complete`、`GET /master` |
| **admin** | 订单列表/详情（assign/cancel）、结算台账页、支付配置页（已建骨架） | `GET /all`、`assign`、`cancel`、`GET/PUT /payments/config` |
| 三端 | WebSocket 客户端（监听 `new-order` / `order-update`） | gateway（未挂载） |

### 3.3 已知缺口与风险（BUG 清单，带优先级）

| 优先级 | 问题 | 位置 | 影响 | 修复方向 |
|---|---|---|---|---|
| ~~**P0**~~ ✅ | WS 网关未挂入 `app.module` | `nest/src/app.module.ts` 缺 `GatewayModule` | `gateway` 注入 undefined，`broadcast*` 静默跳过 → 推送恒失效 | **已修（2026-08-13）**：`app.module` + `orders.module` + `payments.module` 均 import `GatewayModule`；`PaymentsService` 注入 `OrdersGateway`，`applyPaid` 支付成功即 `broadcastNewOrder`（师傅端接单池即时可见）；`OrdersService.transition` 状态变更 `broadcastOrderUpdate` 均已生效 |
| ~~**P0**~~ ✅ | 验收/评价双入口冲突 | `orders.service.confirm` + `reviews.service.create` | `reviews.create` 直置 `Reviewed` 会绕过 `confirm`、不释放托管金 | **已修（2026-08-13）**：`reviews.create` 改为**仅当 `order.status===Reviewed`（已确认验收）才允许评价**，且不再自行改订单状态；资金释放唯一入口收敛到 `confirm()` |
| ~~**P1**~~ ✅ | `grab` 并发无防 | `orders.service.ts:155` | 同单被多师傅同时抢 | **已修（2026-08-13）**：`grab` 改用 `updateMany({where:{id,status:PendingAccept,masterId:null},data:{masterId:mid}})`，count=0 即「已被接走」原子抢占 |
| ~~**P1**~~ ✅ | 真实支付 Provider + 按配置切换 | `payments/wechat.provider.ts` `alipay.provider.ts` `getProvider` | 原恒返回 mock，真实通道未实现/未接线 | **已修（2026-08-13）**：新增 `WechatPaymentProvider`/`AlipayPaymentProvider`（原生 crypto，V3 签名 / 回调解密 / 退款）；`getProvider()` 读 `MerchantConfig`，`enabled && provider!=='mock'` 时返回对应实现；`controller` 新增公开 `POST /notify/wechat`、`/notify/alipay` 走统一 `handleNotify→applyPaid`（待真实凭证 + 公网回调联调） |
| **P2** | `Refunding→Refunded` 绕过 transition | `payments.service.ts:168-171` | refund 直接 `order.update({status:Refunded})`，不写 orderLog、不走统一入口 | 改走 `OrdersService.transition` 或补 orderLog |
| ~~**P2**~~ ✅ | 地域接 `ServiceArea`（P0+P1） | `orders.service.ts create()/grab()` + `masters.service.ts updateMe()` | **已修（2026-08-20）**：下单校验开通区域、抢单二次校验师傅覆盖、师傅配置白名单约束；剩余 P2 WS 广播按区域过滤 + P3 admin 审计列（见 HANDOFF.md 第 15 节） |
| **P2** | 旧二维码凭证支付与前置支付并存 | `payments.controller.ts:66-89` | 两套支付入口并存，语义需收敛（凭证支付属线下/对公场景，可保留但需在文档/UI 区分） | 明确两通道适用场景，避免用户混淆 |

---

## 4. 下一步待办（按优先级）

- [x] **P0-1** 挂 `GatewayModule`：`app.module.ts` + `orders.module.ts` + `payments.module.ts` 均已 import（重启 3721 生效）；`applyPaid` 支付成功即 `broadcastNewOrder`，师傅端接单池即时可见。
- [x] **P0-2** 收口验收/评价双入口：`reviews.create` 仅当 `order.status===Reviewed` 才允许，且不再改订单状态；资金释放唯一入口收敛到 `confirm()`。
- [x] **P1-1** `grab` 并发防：`updateMany` 原子抢占（`where:{id,status:PendingAccept,masterId:null}`），count=0 即「已被接走」。
- [x] **P1-2** 真实支付 Provider：新增 `wechat.provider.ts`/`alipay.provider.ts`（原生 crypto 实现 `PaymentProvider` 三方法）+ `getProvider()` 按 `MerchantConfig` 切换；`controller` 新增公开 `POST /notify/wechat`、`/notify/alipay` 走统一 `handleNotify→applyPaid`（待真实凭证 + 公网回调联调）。
- [ ] **前端 Phase1（最小闭环）**：
  - [ ] client 下单页（`POST /orders`）+ 订单详情（charge / 模拟支付 / cancel / confirm）
  - [ ] master 接单池页（`GET /pool`，**WS 客户端必须用 `socket.io-client` 匹配后端 socket.io 网关 `/ws`，不可用原生 WebSocket**）+ grab + 订单详情（start / complete）
  - [ ] admin 订单台账页（`GET /all` + assign / cancel）+ 结算台账页（读 `settlements`）
  - [x] 支付配置页（骨架已建 + 后端真通道接缝已接线；待真实商户凭证 + 公网回调地址（`WX_MCH_SERIAL`/`WX_NOTIFY_URL`/`ALIPAY_NOTIFY_URL`）联调）
- [x] **三端 WS 客户端**：按订阅改造已落地（JWT 鉴权 + 房间定向 `order:<id>`/`pool`，2026-08-19；详见 HANDOFF.md 第 14 节）
- [ ] **P2** 收尾：`Refunding→Refunded` 补 orderLog、地域闸门剩余项（WS 广播按区域过滤 + admin 审计列）、旧凭证支付语义收敛。

---

## 5. 验收用例（浏览器跑通闭环）

> 以下用例用于判定「下单接单流程（支付前置+托管）」已端到端打通。

1. **下单 → 支付 → 入池**：用户 A 下单（服务项 + 地址 city=广州）→ 状态 `pending_payment`；A 调 `charge` 拿 `payParams.token` → 调 `mock/notify` → `applyPaid` → 状态 `pending_accept`，**接单池可见**（P0 修复后 WS 实时；未修则轮询可见）。
2. **接单 → 服务 → 完成**：师傅 B `grab` → `accepted`；B `start` → `servicing`；B `complete` → `pending_confirm`。
3. **验收 → 释放金 → 评价**：A `confirm` → `reviewed` + 结算台账生成（`settlements` 出现该单 `offline_pending`）；A 评价成功（评价前提 `paidStates` 含 `reviewed`）。
4. **支付后取消 → 退款**：在 `pending_accept/accepted/servicing/pending_confirm` 任一阶段 `cancel` → `refunding` → 调 refund → `refunded`，支付单置 `refunded`。
5. **支付前取消 → 无退款**：在 `pending_payment` 阶段 `cancel` → `cancelled`，无退款、支付单保持 `pending`。
6. **实时性（验证 P0）**：A 支付成功入池后，B 端 WS **立即**收到 `order-update`；B `grab` 后 A 端**立即**收到更新。
7. **归属校验（越权回归）**：B 尝试 `start`/`complete` 非自己接的单 → 403；C 尝试 `charge`/`confirm` 别人订单 → 拒绝（验证 `order.customerId/m.masterId === 当前用户`）。
8. **双入口收口验证（验证 P0-2）**：A 在 `pending_confirm` 状态下**先评价**，应被拒（或评价后 confirm 仍能释放金，取决于 P0-2 选型）—— 当前以「confirm 释放金」为准，确保金币不悬空。

---

## 6. 附录：关键代码索引

| 关注点 | 文件 |
|---|---|
| 状态机定义 | `shared/src/types.ts`（`ORDER_STATUS_FLOW`，L52-62；枚举 L9-26） |
| 状态校验 | `nest/src/orders/order-status.ts`（`canTransition`） |
| 订单业务 | `nest/src/orders/orders.service.ts`（create L53 / grab L155 / start L177 / complete L185 / confirm L199 / cancel L215） |
| 订单端点 | `nest/src/orders/orders.controller.ts` |
| 支付接缝接口 | `nest/src/payments/provider.ts`（`PaymentProvider` 接口） |
| Mock 通道 | `nest/src/payments/mock.provider.ts` |
| 商户配置加密存储 | `nest/src/payments/merchant-config.store.ts`（AES-256-GCM） |
| 支付业务 | `nest/src/payments/payments.service.ts`（charge L81 / mockNotify L104 / applyPaid L120 / refund L146） |
| 支付端点 | `nest/src/payments/payments.controller.ts` |
| 托管金释放 | `nest/src/settlements/settlements.service.ts`（releaseToMaster L53 / syncForPaidOrders L19） |
| 评价门槛 | `nest/src/reviews/reviews.service.ts`（paidStates L30-36） |
| 网关挂载点 | `nest/src/app.module.ts`（**当前缺 `GatewayModule`**） |
| 前端支付配置页 | `next/src/app/admin/settings/payment/page.tsx` |
| 前端支付 API | `next/src/lib/admin-api.ts`（`getPaymentConfig` / `savePaymentConfig`） |
| 前端接单位置（待建） | `next/src/app/{client,master,admin}/**`（当前无 orders 目录） |
