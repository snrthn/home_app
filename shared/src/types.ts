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
  Servicing = 'servicing', // 服务中
  PendingConfirm = 'pending_confirm', // 待验收（师傅完成，待客户确认）
  Reviewed = 'reviewed', // 已评价（终态，托管金已释放给师傅）
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
  OfflinePending = 'offline_pending', // 待线下结算给师傅
  OfflineDone = 'offline_done', // 已线下结算
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
//  → 接单(accepted) → 服务中(servicing) → 待验收(pending_confirm)
//  → 客户确认(reviewed，托管金释放给师傅)
//  支付后任意阶段取消 → 退款中(refunding) → 已退款(refunded)
//  仅「待支付」阶段取消 = 无退款(cancelled)
export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PendingPayment]: [OrderStatus.PendingAccept, OrderStatus.Cancelled],
  [OrderStatus.PendingAccept]: [OrderStatus.Accepted, OrderStatus.Refunding],
  [OrderStatus.Accepted]: [OrderStatus.Servicing, OrderStatus.Refunding],
  [OrderStatus.Servicing]: [OrderStatus.PendingConfirm, OrderStatus.Refunding],
  [OrderStatus.PendingConfirm]: [OrderStatus.Reviewed, OrderStatus.Refunding],
  [OrderStatus.Reviewed]: [],
  [OrderStatus.Refunding]: [OrderStatus.Refunded],
  [OrderStatus.Refunded]: [],
  [OrderStatus.Cancelled]: [],
};
