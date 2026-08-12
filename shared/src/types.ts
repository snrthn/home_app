// 全局共享枚举与基础类型（前后端共用，避免魔数字符串漂移）

export enum Role {
  Admin = 'admin',
  Master = 'master',
  Customer = 'customer',
}

export enum OrderStatus {
  PendingAccept = 'pending_accept', // 待接单
  Accepted = 'accepted', // 已接单
  Servicing = 'servicing', // 服务中
  PendingPayment = 'pending_payment', // 待支付
  Paid = 'paid', // 已支付
  Reviewed = 'reviewed', // 已评价（终态）
  Cancelled = 'cancelled', // 已取消
}

export enum PaymentStatus {
  Pending = 'pending',
  Paid = 'paid',
  Confirmed = 'confirmed',
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
export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PendingAccept]: [OrderStatus.Accepted, OrderStatus.Cancelled],
  [OrderStatus.Accepted]: [OrderStatus.Servicing, OrderStatus.Cancelled],
  [OrderStatus.Servicing]: [OrderStatus.PendingPayment, OrderStatus.Cancelled],
  [OrderStatus.PendingPayment]: [OrderStatus.Paid, OrderStatus.Cancelled],
  [OrderStatus.Paid]: [OrderStatus.Reviewed],
  [OrderStatus.Reviewed]: [],
  [OrderStatus.Cancelled]: [],
};
