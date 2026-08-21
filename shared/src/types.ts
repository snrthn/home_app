// 全局共享枚举与基础类型（前后端共用，避免魔数字符串漂移）

export enum Role {
  Admin = 'admin',
  Master = 'master',
  Customer = 'customer',
}

export enum OrderStatus {
  PendingPayment = 'pending_payment', // 待支付（下单后初始态，平台托管前）
  PendingAccept = 'pending_accept', // 待接单（已支付，资金进入平台托管）
  Accepted = 'accepted', // 已接单
  Departing = 'departing', // 出发上门中（师傅已出发，前往客户地址）
  Arrived = 'arrived', // 已到达（师傅到达现场，客户验证码确认）
  Servicing = 'servicing', // 服务中
  PendingConfirm = 'pending_confirm', // 待验收（师傅完成，待客户确认）
  Reviewed = 'reviewed', // 已完成（客户已验收、托管金已释放，待客户评价）
  Evaluated = 'evaluated', // 已评价（客户评价后的终态，纯展示标记，不涉及资金）
  Refunding = 'refunding', // 退款中（支付后取消触发）
  Refunded = 'refunded', // 已退款（终态）
  Cancelled = 'cancelled', // 已取消（仅支付前取消，无退款）
}

export enum PaymentStatus {
  Pending = 'pending',
  Paid = 'paid',
  Confirmed = 'confirmed',
  Refunded = 'refunded', // 已退款
}

export enum SettlementStatus {
  Pending = 'pending', // 待入账（退款补偿单：管理端审核确认后入账）
  Credited = 'credited', // 已入账（常规单验收即时入账；补偿单审核通过后入账）
  Rejected = 'rejected', // 已驳回（补偿单被否决，不入账）
}

export enum SettlementType {
  Normal = 'normal', // 常规结算单（订单验收后自动生成，即时入账）
  Compensation = 'compensation', // 退款补偿单（阶梯退款师傅应得部分，管理端审核后入账）
}

export enum WithdrawalChannel {
  Wechat = 'wechat', // 微信
  Alipay = 'alipay', // 支付宝
  Bank = 'bank', // 银行卡
}

export enum WithdrawalStatus {
  Pending = 'pending', // 待审核（金额已冻结）
  Paid = 'paid', // 已打款
  Rejected = 'rejected', // 已驳回（解冻退回余额）
}

export enum MasterStatus {
  Pending = 'pending', // 待审核
  Active = 'active', // 已激活
  Disabled = 'disabled', // 停用
}

export interface JwtPayload {
  sub: string; // userId
  role: string;
  phone: string;
}

// 订单状态流转白名单（状态机校验用）
// 支付前置 + 平台担保托管模型：
//  创建 → 待支付(pending_payment) → 支付成功(平台托管) → 待接单(pending_accept)
//  → 接单(accepted) → 出发上门(departing) → 已到达(arrived) → 服务中(servicing)
//  → 待验收(pending_confirm) → 客户确认(reviewed，托管金释放给师傅)
//  支付后任意阶段取消 → 退款中(refunding) → 已退款(refunded)
//  仅「待支付」阶段取消 = 无退款(cancelled)
//  已完单（reviewed/evaluated）→ refunding：仅投诉处置退款申请经运营审核通过后触发
//  （见 docs/refund-aftersale-design.md 第 3 节：该出口只被 payments.reviewRefund 的
//   allowCompleted 场景使用，客户/师傅侧无入口）。
export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PendingPayment]: [OrderStatus.PendingAccept, OrderStatus.Cancelled],
  [OrderStatus.PendingAccept]: [OrderStatus.Accepted, OrderStatus.Refunding],
  [OrderStatus.Accepted]: [OrderStatus.Departing, OrderStatus.Refunding],
  [OrderStatus.Departing]: [OrderStatus.Arrived, OrderStatus.Refunding],
  [OrderStatus.Arrived]: [OrderStatus.Servicing, OrderStatus.Refunding],
  [OrderStatus.Servicing]: [OrderStatus.PendingConfirm, OrderStatus.Refunding],
  [OrderStatus.PendingConfirm]: [OrderStatus.Reviewed, OrderStatus.Refunding],
  // 评价流转：Reviewed(已完成/待评价) → Evaluated(已评价)。资金释放仍只走 confirm 单一入口。
  [OrderStatus.Reviewed]: [OrderStatus.Evaluated, OrderStatus.Refunding],
  [OrderStatus.Evaluated]: [OrderStatus.Refunding],
  [OrderStatus.Refunding]: [OrderStatus.Refunded],
  [OrderStatus.Refunded]: [],
  [OrderStatus.Cancelled]: [],
};
