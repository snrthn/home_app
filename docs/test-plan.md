# 测试覆盖规划（2026-08-24 定稿）

> 目标：让「改错会赔钱」的核心逻辑全部有回归保护。
> 覆盖率的数字不是 KPI——P0+P1 完成后，金额/状态机/派单算法全部有保护，那才是这轮的目标。

## 基线

- 全仓源码：`nest/src` 下 112 个 ts 文件 / 8882 行
- 当前覆盖：**0.45% statements**（仅 `tier.util.ts` 一个文件，8/8 PASS）
- 测试基建：jest + ts-jest（`nest/jest.config.js`），`@laoma/shared` 经 moduleNameMapper 映射到 `shared/dist/index.js`

## 核心业务链路全景

三条资金链 + 一条辅助链（详见会话梳理）：

| 链路 | 环节 | 文件:函数 |
|---|---|---|
| ① 正向履约 | 下单 | `orders.service.create`（地域闸门 `regionMatches` + 分账快照 `commission.resolve`） |
| ① 正向履约 | 支付托管 | `payments.charge/applyPaid`（仅 pending_payment 可付、幂等） |
| ① 正向履约 | 抢单 | `orders.grab`（乐观锁 updateMany count=0 防并发） |
| ① 正向履约 | 履约 | `orders.transition`（状态机总闸 `canTransition` + orderLog + 广播） |
| ① 正向履约 | 验收 | `orders.confirm`（客户权限 + `releaseToMaster`） |
| ① 正向履约 | 结算入账 | `settlements.releaseToMaster`（`splitNormal` 分账、幂等） |
| ② 逆向退款 | 取消 | `orders.cancel`（支付前/后分叉 `POST_PAY_STATES`、预流转 refunding） |
| ② 逆向退款 | 阶梯退款 | `payments.refund`（`splitRefund` full/tiered/keep_commission、两段式流转、补偿单） |
| ② 逆向退款 | 补偿单 | `settlements.createCompensation`（幂等、pending） |
| ② 逆向退款 | 确认入账 | `settlements.credit`（仅 pending → credited） |
| ③ 售后投诉 | 提交投诉 | `tickets.createTicket`（仅 reviewed/evaluated 可投诉、SLA 档位） |
| ③ 售后投诉 | 处置 | `tickets.resolveComplaint`（refund/compensate/redispatch/no_fault 四结果） |
| ③ 售后投诉 | 退款申请 | `payments.createRefundRequest`（同单去重） |
| ③ 售后投诉 | 审核执行 | `payments.reviewRefund`（仅 pending_review 可审、approve → refund） |
| ④ 师傅提现 | 提现申请 | `withdrawals.create`（事务内聚合余额校验防超提） |
| ④ 师傅提现 | 打款/驳回 | `markPaid/reject`（乐观锁状态守卫） |

## P0 纯函数层（无 DB，纯输入输出，一批 spec）

> 目标：把零副作用、可独立验证的核心判定全部锁死。覆盖率 0.45% → ~6%。

| 函数 | 位置（现状） | 语义 | 测试要点 |
|---|---|---|---|
| `canTransition` | `orders/order-status.ts:3`（已导出） | 状态机流转总闸 | 合法流转 true；非法流转 false；未知状态 false |
| `regionMatches` | `common/region-match.ts:29`（已导出） | 地域规则命中 | 空规则→true；省/市/区各级命中与缺级通配；规则限定级缺 code 不命中；名称不参与匹配 |
| `serviceAreasToRules` | `common/region-match.ts:47`（已导出） | ServiceArea 转规则集 | level 1/2/3 各级裁剪；null code 透传 |
| `resolveTierRatio` | `commission/tier.util.ts:20`（已导出，有 spec） | 退款区间解析 | 已覆盖，补：非可取消状态兜底 1 |
| `splitNormal` | `commission.service.ts:152`（类内，**提纯**） | 常规分账 | 平台费率 0/0.1/0.5/1；round2 精度；金额 0/负数/非数 |
| `splitRefund` | `commission.service.ts:163`（类内，**提纯**） | 退款三方分账 | full/tiered/keep_commission 三策略；平台费率边界；round2 精度 |
| `masterCoversOrder` | `orders.service.ts:137`（私有，**提纯**） | 师傅地域覆盖判定 | 所在地∪接单范围并集；两者皆空→false；code-only |
| `slotsOverlap` | `orders.service.ts:315`（私有 static，**提纯**） | 预约时段重叠 | "HH:mm-HH:mm" 区间相交（半开）；自由文本相等；空值 false；边界相接 false |

### 提纯原则

- 纯抽取：把类内方法/私有方法移到独立 util 文件并 `export`，**行为零变更**，service 改为 import 调用。
- `splitNormal`/`splitRefund` → `commission/split.util.ts`（依赖 `CommissionSnapshot` 类型 + `round2`，类型 import 自 commission.service）。
- `masterCoversOrder`/`slotsOverlap` → `orders/master.util.ts`（依赖 `regionMatches`，保持 code-only 语义）。

## P1 金额守卫（mock prisma + mock provider，service 级）

> 目标：资金流核心路径的守卫条件全部钉死。→ ~18%。

| 目标 | 守卫条件 | 测试要点 |
|---|---|---|
| `payments.refund` 三策略 | full/tiered/keep_commission 各自金额分配 | 每策略正常/边界；round2；`allowCompleted` 分支 |
| `orders.cancel` 分叉 | `POST_PAY_STATES` 支付前/后 | 支付前直接取消；支付后预流转 refunding；原因必填 |
| `settlements.releaseToMaster` | 幂等 | 重复调用不重复入账；snapshotFromOrder 缺失兜底 |
| `withdrawals.create` 防超提 | available = credited − paid − pending | 事务内聚合；并发超提被拒 |
| `commission.resolve` 三级降级 | service → category 链 → global → default | 各级命中；类目链限深 10；无规则回落 default |

## P2 链路 e2e（supertest 打真服务）

> 目标：全链路状态机端到端打通。→ ~22%+。

| 链路 | 场景 |
|---|---|
| 正向全链 | 下单 → 支付确认 → 抢单 → 履约 → 验收 → 结算入账 |
| 售后链 | 投诉 → 审核 → 退款执行 → 补偿单 |

- 跑法：临时起服 3722（复用用户固定 3721 之外的口子），supertest 直连，跑完退服（纪律：netstat 确认 LISTEN 消失）。

## 验收标准

- [x] P0：全部 spec 绿，`pnpm --filter @laoma/backend test` EXIT=0，双端 `tsc --noEmit` EXIT=0（5 suites / 107 tests PASS；被测文件 96-100% 语句覆盖；整体 2.55% — 因 util 文件行数占比小，~6% 为乐观估计）
- [x] P1：5 个目标 service 级守卫全测，10 suites / 195 tests PASS，双端 tsc EXIT=0（覆盖率整体 ~8%，因 mock 了 prisma 层未覆盖 controller/repository 行数，~18% 为乐观估计）
- [x] P2：两条链路 e2e 绿（2 suites / 16 tests PASS），双端 tsc EXIT=0
  - 正向全链（11 tests）：下单→支付→抢单→出发→到达→开始→完成→验收→结算单生成
  - 售后链（5 tests）：投诉→退款处置→退款审核→全额退款（reviewed 不在阶梯断点→无补偿单）；投诉→compensate 处置→工单 resolved
- [x] 每批次完成回填 engineering.md E-04 状态 + 本文件勾选
