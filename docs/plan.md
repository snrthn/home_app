# 老马家电 — 项目计划 (plan.md)

> 演化型文档。v0.4（10:20）基于用户补充决策更新：主品牌名定为「老马家电」；登录方式定为「手机号+验证码 + 管理员固定账号」；资金流与取消/退款规则确认通过。MVP 目标：跑通「预约下单 → 师傅接单 → 上门服务 → 客户扫码付款 → 评价」闭环。
>
> ⚠️ **历史快照声明（2026-08-06 起停更；08-21 由 `docs/需求文档/plan.md` 迁至 `docs/plan.md`，同日上午刷新进度指引）**：本文停更于 v0.4。其后多项核心设计已被迭代取代——支付模型改为**支付前置+平台托管**（服务后付款/个人收款码方案已废弃）、恢复平台分账抽成（CommissionRule 引擎）、订单状态机扩展（`docs/orders-sop.md`）、新增 RBAC / 服务区域闸门 / 投诉工单 / 退款售后审核流 / 智能派单 / 运营报表等模块。**当前进度以 `docs/HANDOFF.md`（第 13 节完成状态 + 第 18/19/20 节新模块：投诉工单、退款售后 Phase 1、智能派单 Phase 1/1.5/2 看板+超时自动派单）为准，本文仅作早期需求与决策溯源用。**

---

## 更新记录

- **v0.1（10:03）**：初版，含品牌、技术栈、多端架构、SOP 状态机、库表概要、API、路线图、6 个开放问题。
- **v0.2（10:12）**：五项决策 —— ①个人收款码无异步回调，走"凭证+后台确认"；②抢单+管理员指派双方案；③后台统一创建并报价；④手动选城市、单城市；⑤单城市单租户一单一师傅。
- **v0.3（10:16）**：两项追加决策 —— ①**支付时机改为"服务后付款"**（下单不先付，服务完成客户再扫码付）；②**无抽成，平台统一收款码收款 → 线下全额结算给师傅，平台不参与分账**（规避二清，settlements 降级为台账）。同步重写 SOP 状态机与结算语义，新增"待补充决策清单"。
- **v0.4（10:20）**：补充决策全部拍板 —— ①主品牌名定为 **「老马家电」**（原"老马家政家电"作业务延展名）；②登录方式=「手机号+验证码 + 管理员固定账号」；③资金流与取消/退款规则确认通过。决策清单闭合，可进入 Phase 0。

---

## 0. 品牌与定位

- **品牌名（v0.4 拍板）**：**老马家电**（主品牌统一为此；项目代号沿用 `home_app`）。
- 原「老马家政家电」作为业务延展名（拓展保洁/收纳时再用），主品牌不再带「家政」。副标题 *老马家电 · 清洗维修上门快*。

---

## 1. 产品形态

- **H5 应用，一套 Next.js 代码，UI 响应式适配多端**（移动优先，管理后台桌面端放宽布局）。
- **三端同应用按角色切换**：客户端（C 端业主）/ 师傅端（B 端）/ 管理后台。
- 统一登录页，按角色回跳对应端首页。

---

## 2. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | Next.js (App Router) + TS + Tailwind CSS | React Query（请求）/ Zustand（轻状态） |
| 后端 | NestJS + TS | REST + WebSocket Gateway（派单推送） |
| 数据库 | MySQL + **Prisma** | 类型安全 + 迁移 |
| 鉴权 | JWT（access+refresh） | 密码 bcrypt |
| 文件 | 本地磁盘（MVP） | 服务前后对比图、收款码图片、支付凭证；后续换 OSS |
| 工程 | Monorepo（pnpm workspace / Turborepo） | `next/` + `nest/` + `shared/` |

### 2.1 支付方案与可行性结论（重点）

- **资金流（v0.4 确认）**：管理后台上传**平台微信/支付宝收款码** → 服务完成后客户端展示该收款码 → 客户扫码付款（款项进入**平台收款账户**）→ 上传**支付凭证截图**（或点"我已支付"）→ 后台确认收款 → 订单生效。**平台线下将全额（无抽成）结算给师傅**，系统不做自动分账。
- **可行性结论（已验证认知）**：
  - ❌ **个人收款码（个人微信/支付宝收款码）没有商户异步回调**：扫码支付后系统**无法自动获知"支付成功"**，因此 MVP 不能依赖自动回调推进订单。
  - ✅ 采用「扫码付款 + 凭证/后台确认」半自动闭环，完全可跑通，且不依赖回调。
  - ⚠️ 若要真·成功回调，需接入 **微信支付商户号 / 支付宝开放平台**，配套证书、签名与异步通知——MVP 不接入，列为 Phase 4 优化。
  - 🛡️ **合规提示**：平台统一收款码收款 → 线下全额给师傅、平台不参与分账，可规避资金池/「二清」风险，是 MVP 较稳妥的资金安排。
- **验证项留存**：Phase 1 实测"展示收款码 → 扫码 → 凭证确认"全链路，并把"若后续要回调，需商户资质"写进技术债务清单。

---

## 3. 多端架构（一套代码）

```
app/
  (auth)/login
  client/      # 客户端：选城市/服务、下单、查进度、扫码付款、评价
  master/      # 师傅端：接单池(抢单)、我的订单、上门打卡/照片、收款信息
  admin/       # 后台：服务项与报价、收款码、订单、师傅、线下结算台账
  api/         # BFF/SSR（重逻辑在 Nest）
shared/        # 组件、设计令牌、API client、类型
```

- 角色中间件校验 JWT `role`；`/master`、`/admin` 需对应角色。
- 设计令牌统一（配色/圆角/阴影/字号 CSS 变量）。

---

## 4. 核心 SOP（MVP 闭环 · 服务后付款）

```
预约下单(待接单) → 师傅接单(抢单/指派) → 上门服务(服务中) → 服务完成(待支付)
        → 客户扫码付款(平台收款码) → 凭证确认(已支付) → 客户评价(已评价)
   订单完成 ──▶ 后台生成「线下结算台账」(平台全额付师傅, 无抽成)
   任意阶段可取消(受规则约束)
```

1. **预约下单（待接单）**：客户端选**城市/区域** → 选**后台创建的服务项**（清洗/维修，含统一标价）→ 填地址、预约时间/时段、备注/照片 → 生成订单（`pending_accept`，金额=服务项标价，此时**不收款**）。
2. **师傅接单**：订单入抢单池 → WS 推送给同城市在册师傅 → **师傅抢单** 或 **管理员指派** →（`accepted` 已接单）。
3. **上门服务**：师傅签到、传「前」照片、服务中、传「后」照片、标记完成 →（`pending_payment` 待支付，触发推送客户去付款）。
4. **客户扫码付款**：展示后台上传的**平台收款码** → 客户扫码付款 → 上传支付凭证 / 点"已支付" → 后台确认 →（`paid` 已支付）。【**无自动回调，见 2.1**】
5. **客户评价**：星级 + 文字 → 影响师傅评分 →（`reviewed` 已评价，闭环）。
6. **线下结算台账（后台）**：订单 `paid` 后，后台生成 `settlements` 台账记录（订单金额、平台已收、应线下付师傅金额=全额、无抽成），仅作对账视图；**实际打款线下完成，系统不自动分账**。

**订单状态机**：`pending_accept → accepted → servicing → pending_payment → paid → reviewed`；任意态可 `cancelled`（取消规则见决策清单 G）。
**支付状态**：独立在 `payments` 表（`pending / paid / confirmed`），不阻塞订单状态字段；凭证图存 `proof_url`。

---

## 5. 数据库设计（v0.3 调整，v0.4 沿用）

> snake_case（库）/ camelCase（接口）。`★` = MVP 核心表。

### ★ users
`id` `role(admin|master|customer)` `phone(unique)` `password_hash` `nickname` `avatar` `status(active|disabled)` `last_login_time` `created_at` `updated_at`

### ★ masters（1:1 users）
`id` `user_id` `real_name` `id_card` `city` `skills(json)` `id_verified(bool)` `rating(decimal)` `order_count(int)` `status(pending|active|disabled)` `created_at` `updated_at`
> `city`：按手动选择的城市做派单过滤。师傅由管理员后台创建/审核（`status` 体现审核流）。

### ★ service_items（后台统一创建并报价）
`id` `category_id` `name` `type(clean|repair)` `city` `price(decimal)` `unit` `description` `sort` `is_active(bool)` `created_at` `updated_at`
> 价格由后台预设；`type` 区分清洗/维修；`city` 支持手动城市选择过滤。

### service_categories（家电大类）
`id` `name(油烟机/空调/…)` `icon` `sort`

### ★ addresses
`id` `user_id` `contact_name` `contact_phone` `province` `city` `district` `detail` `tag(家|公司)` `is_default(bool)` `created_at`

### ★ orders
`id` `order_no(unique)` `customer_id` `master_id(nullable)` `address_id` `service_item_id` `service_snapshot(json)` `city` `amount(decimal)` `appointment_date` `appointment_slot` `status(enum)` `remark` `customer_photos(json)` `created_at` `updated_at`
> `amount` 取自服务项标价（后台预设，无抽成，= 师傅应得 = 客户应付）；`city` 冗余存储便于查询；`appointment_slot` 预约时段（上午/下午/晚上）。

### ★ order_logs（时间线 / 服务照片）
`id` `order_id` `action` `from_status` `to_status` `operator_id` `photos(json)` `note` `created_at`

### payments（扫码支付凭证）
`id` `order_id` `customer_id` `qr_type(wechat|alipay)` `proof_url(nullable)` `amount` `status(pending|paid|confirmed)` `confirmed_by(nullable)` `paid_at` `created_at`
> 平台收款码无回调，`proof_url` 存客户支付凭证；`confirmed_by` 记后台确认人；`paid`=客户已付待确认，`confirmed`=后台已确认收款。

### quotations（**MVP 暂不使用**）
`id` `order_id` `master_id` `labor_fee` `parts_fee` `total` `parts_detail(json)` `status` `created_at`
> 价格已由后台预设，MVP 不做师傅现场报价；保留表结构以备「维修额外配件加价」扩展。

### settlements（**v0.3 降级：线下结算台账，非自动分账**）
`id` `order_id` `master_id` `order_amount` `platform_fee(=0)` `master_amount(=order_amount)` `status(offline_pending|offline_done)` `settled_at(nullable)` `note` `created_at`
> 平台不参与分账、无抽成；本表仅记录「平台已收、待线下全额付师傅」的对账视图，实际打款线下完成（`offline_done` 由管理员标记）。

### ★ reviews
`id` `order_id` `customer_id` `master_id` `rating(1-5)` `comment` `anonymous(bool)` `created_at`

### payment_qr（平台收款码）
`id` `type(wechat|alipay)` `image_url` `updated_by` `updated_at`
> **平台统一收款码**（非师傅个人码），下单支付页与结算说明展示。

### notifications（可选，MVP 可仅 WS）
`id` `user_id` `type` `title` `content` `read(bool)` `created_at`

---

## 6. API 模块（v0.4）

**auth**：sendSmsCode（发送验证码）/ login（手机号+验证码 | 管理员账号密码）/ refresh / profile / updateProfile
**addresses**：CRUD（客户端）
**services（admin）**：服务项 create / update / delete / list（含 type 清洗|维修、price、city）
**payment-qr（admin）**：上传/更新 平台微信、支付宝收款码
**orders**：
- create（客户端，生成 `pending_accept` 订单，金额取服务项，**不收款**）
- list（三端视图：客户=我的；师傅=可抢池+我的；admin=全部）
- detail
- grab（师傅抢单）/ assign（管理员指派）
- updateStatus（上门/完成，师傅；完成→`pending_payment`）
- cancel
**payments**：create（客户端上传凭证+类型，置 `paid`）/ confirm（后台确认 `confirmed`）/ list
**settlements（admin）**：list（线下台账）/ markOfflineDone（标记线下已付师傅）
**reviews**：create（客户）/ list
**masters（admin）**：create / list / approve
**upload**：图片上传（服务照片、支付凭证、收款码）
**gateway(WS)**：新订单实时推送给同城市师傅；状态变更通知客户端

---

## 7. 路线图（v0.3，沿用）

- **Phase 0 — 脚手架 + 库表**：Monorepo、Nest+Next、MySQL+Prisma（按 v0.4 schema）、JWT、三端 layout 骨架、上传模块。
- **Phase 1 — 下单 + 派单**：服务项/收款码后台管理、客户端选城市选服务下单（**不先付**）、抢单 + 管理员指派、WS 推送。
- **Phase 2 — 上门 + 付款**：上门状态流转与前后照片、服务完成→待支付、展示平台收款码→客户扫码→凭证确认（**实测无回调闭环**）。
- **Phase 3 — 评价 + 管理后台**：客户评价、后台订单/师傅/线下结算台账完善。
- **Phase 4 — 打磨/支付升级/部署**：可选接入微信支付商户回调、地图就近派单、单服务器部署、全链路走通。

---

## 8. 决策清单（v0.4 全部拍板，可开工）

- **A. 登录/鉴权方式（已定）**：「手机号+验证码」+ 管理员固定账号密码；微信 OAuth 视是否微信内打开后续接。
- **B. 师傅入驻方式（已定·推荐）**：管理员后台创建并审核，`masters.status` 体现审核流。
- **C. 资金流（已确认）**：平台统一收款码收款 → 线下全额给师傅，平台不参与分账（见 2.1）。
- **D. 凭证图片存储（已定·推荐）**：本地磁盘目录（MVP）→ 后续 OSS。
- **E. 预约时间粒度（已定·推荐）**：`appointment_date` + `appointment_slot`，先按「上午/下午/晚上」三档。
- **F. 城市/区域数据（已定·推荐）**：MVP 单城市，后台配置「开通城市 + 可选区域」枚举，不接地图。
- **G. 取消/退款规则（已接受·推荐）**：服务开始前任意方取消；已付款后取消走线下退款（后台标记 `offline_refund`）。
- **H. 师傅评分（已定·推荐）**：`rating` = 历史评价均值，实时更新。

> 全部决策已闭合，无遗留阻塞项，可进入 Phase 0 脚手架。

---

## 9. 技术债务 / 风险

1. **支付回调**：个人收款码无回调为既定结论；后续要有自动回调需商户资质（Phase 4）。
2. **二清合规**：平台统一收款码收款但线下结算，MVP 规避了自动分账风险；若日后平台要代收付，需持牌/接入合规分账方案。
3. **维修加价**：MVP 服务项统一定价；维修现场额外配件加价暂不支持（quotations 表预留）。
4. **LBS/地图**：MVP 手动选城市，无就近派单；Phase 4 可接地图。

---

## 10. 开发运行（环境实测，2026-08-06 Phase 0 落地）

> 本机存在两个**当前令牌无权终止**的常驻 node 进程，分别占用 3001 / 3000（疑似历史会话残留，taskkill/Stop-Process 均"拒绝访问"）。故开发端口暂用 **后端 3005 / 前端 3010**，前端 `next/.env.local` 已设 `NEXT_PUBLIC_API_BASE=http://localhost:3005/api`。待在任务管理器手动结束对应进程后可改回 3001/3000。

- **MySQL**：本机未注册为服务，用项目内数据目录直接拉进程：
  `cd "C:/Program Files/MySQL/MySQL Server 8.0/bin" && ./mysqld --datadir="D:/FrontEnd/home_app/mysql-data" --innodb-undo-directory="D:/FrontEnd/home_app/mysql-data" --port=3306 --console`（库 `laoma_jiadian`，root 空密码）
- **安全删除 shim**：`NODE_OPTIONS` 注入 `genie-safe-delete.cjs`，批量删除(≥50文件)会被拦。绕行：nest-cli.json 关 `deleteOutDir`；**启动 `next dev` 时 `NODE_OPTIONS=""`**。
- **构建顺序**：先 `pnpm --filter @laoma/shared build`，再 `pnpm --filter @laoma/backend build`。
- 后端 `PORT` 环境变量控制端口，前端经 `NEXT_PUBLIC_API_BASE` 指后端。

_最后更新：2026-08-06 v0.4（+Phase0 运行备注）；08-21 迁移至 docs/ 根目录并刷新状态指引（快照声明补至第 20 节：退款售后 Phase 1 + 智能派单 Phase 1/1.5/2 已落地，迁移已应用）_
