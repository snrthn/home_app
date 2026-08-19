// 下单接单全流程 API 封装（客户 / 师傅 / 管理 / 支付 / 地址 / 结算）。
// 统一走 api（axios 实例，带 cookie 凭证）；返回后端原始 data。
import api from './api';
import type { OrderStatus } from './order-status';

// ---------- 类型 ----------
export interface OrderLite {
  id: string;
  orderNo: string;
  status: OrderStatus;
  amount: string | number;
  appointmentDate?: string | null;
  appointmentSlot?: string | null;
  remark?: string | null;
  // 取消原因（取消时必填落库），三端订单信息卡展示
  cancelReason?: string | null;
  createdAt: string;
  serviceItem?: {
    id: string;
    name: string;
    price: string | number;
    unit?: string | null;
    description?: string | null;
    coverImage?: string | null;
  } | null;
  master?: {
    id: string;
    realName?: string;
    rating?: number | string | null;
    orderCount?: number | null;
    user?: { phone?: string | null; profile?: { nickname?: string | null } } | null;
  } | null;
  address?: {
    contactName: string;
    contactPhone: string;
    province?: string | null;
    city: string;
    district?: string | null;
    detail: string;
  } | null;
  customer?: { phone?: string; profile?: { nickname?: string | null } } | null;
  // 一单一评：列表/详情带出的本单评价（非空 = 已评价），供「去评价」按钮显隐与评价卡片渲染
  review?: {
    rating: number;
    comment?: string | null;
    anonymous?: boolean;
    createdAt?: string;
  } | null;
}

export interface ChargeResult {
  tradeNo: string;
  payParams: { type: string; token: string; [k: string]: unknown };
}

// ---------- 客户端 ----------
export function createOrder(dto: {
  serviceItemId: string;
  addressId: string;
  appointmentDate?: string;
  appointmentSlot?: string;
  remark?: string;
}): Promise<OrderLite> {
  return api.post('/orders', dto).then((r) => r.data);
}
export function getMyOrders(): Promise<OrderLite[]> {
  return api.get('/orders/mine').then((r) => r.data ?? []);
}
export function confirmOrder(id: string): Promise<OrderLite> {
  return api.post(`/orders/${id}/confirm`).then((r) => r.data);
}
export function cancelMyOrder(id: string, reason: string): Promise<OrderLite> {
  return api.post(`/orders/${id}/cancel`, { reason }).then((r) => r.data);
}

// ---------- 评价（客户对已完成订单） ----------
export function createReview(dto: {
  orderId: string;
  rating: number;
  comment?: string;
  anonymous?: boolean;
}): Promise<unknown> {
  return api.post('/reviews', dto).then((r) => r.data);
}

// 管理端评价列表（GET /reviews，Admin 角色）
export interface ReviewItem {
  id: string;
  rating: number;
  comment?: string | null;
  anonymous: boolean;
  createdAt: string;
  master?: {
    realName?: string | null;
    user?: { profile?: { nickname?: string | null } } | null;
  } | null;
  customer?: { profile?: { nickname?: string | null } } | null;
  order?: { orderNo: string } | null;
}
export function getReviews(): Promise<ReviewItem[]> {
  return api.get('/reviews').then((r) => r.data ?? []);
}

// ---------- 师傅端 ----------
export function getOrderPool(city?: string): Promise<OrderLite[]> {
  return api
    .get('/orders/pool', { params: city ? { city } : {} })
    .then((r) => r.data ?? []);
}
export function getMasterOrders(city?: string): Promise<OrderLite[]> {
  return api
    .get('/orders/master', { params: city ? { city } : {} })
    .then((r) => r.data ?? []);
}
export function grabOrder(id: string): Promise<OrderLite> {
  return api.post(`/orders/${id}/grab`).then((r) => r.data);
}
export function departOrder(id: string): Promise<OrderLite> {
  return api.post(`/orders/${id}/depart`).then((r) => r.data);
}
export function arriveOrder(id: string, code: string): Promise<OrderLite> {
  return api.post(`/orders/${id}/arrive`, { code }).then((r) => r.data);
}
export function generateArriveCode(id: string): Promise<{ code: string }> {
  return api.post(`/orders/${id}/generate-arrive-code`).then((r) => r.data);
}
export function startOrder(id: string): Promise<OrderLite> {
  return api.post(`/orders/${id}/start`).then((r) => r.data);
}
export function completeOrder(id: string): Promise<OrderLite> {
  return api.post(`/orders/${id}/complete`).then((r) => r.data);
}

// ---------- 管理端 ----------
export function getAllOrders(): Promise<OrderLite[]> {
  return api.get('/orders/all').then((r) => r.data ?? []);
}
export function assignOrder(id: string, masterId: string): Promise<OrderLite> {
  return api.post(`/orders/${id}/assign`, { masterId }).then((r) => r.data);
}
export function cancelOrderAdmin(id: string, reason: string): Promise<OrderLite> {
  return api.post(`/orders/${id}/cancel`, { reason }).then((r) => r.data);
}

// ---------- 支付（平台托管 + 模拟回调） ----------
export function chargeOrder(orderId: string): Promise<ChargeResult> {
  return api.post('/payments/charge', { orderId }).then((r) => r.data);
}
export function mockPayNotify(orderId: string, token: string): Promise<OrderLite> {
  return api.post('/payments/mock/notify', { orderId, token }).then((r) => r.data);
}
// 一笔模拟支付：发起 charge 拿到 token，再回调 notify 完成支付（走与真实通道一致的异步范式）
export async function payByMock(orderId: string): Promise<OrderLite> {
  const res = await chargeOrder(orderId);
  return mockPayNotify(orderId, res.payParams.token);
}
export function refundOrder(orderId: string): Promise<OrderLite> {
  return api.post('/payments/refund', { orderId }).then((r) => r.data);
}

// ---------- 客户地址 ----------
export interface Address {
  id: string;
  contactName: string;
  contactPhone: string;
  province?: string | null;
  city: string;
  district?: string | null;
  detail: string;
  tag?: string | null;
  isDefault: boolean;
  createdAt?: string;
}
export function getMyAddresses(): Promise<Address[]> {
  return api.get('/addresses').then((r) => r.data ?? []);
}
export function createAddress(
  dto: Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean },
): Promise<Address> {
  return api.post('/addresses', dto).then((r) => r.data);
}
export function updateAddress(
  id: string,
  dto: Partial<Omit<Address, 'id'>>,
): Promise<Address> {
  return api.patch(`/addresses/${id}`, dto).then((r) => r.data);
}
export function deleteAddress(id: string): Promise<void> {
  return api.delete(`/addresses/${id}`).then((r) => r.data);
}
export function setDefaultAddress(id: string): Promise<Address> {
  return api.post(`/addresses/${id}/default`).then((r) => r.data);
}

// ---------- 公开服务项（下单选服务用，无需鉴权） ----------
export interface PublicServiceItem {
  id: string;
  name: string;
  price: string;
  unit?: string | null;
  categoryId: string;
  coverImage?: string | null;
  estimatedDuration?: number | null;
}
export function getPublicServiceItems(): Promise<PublicServiceItem[]> {
  return api.get('/services').then((r) => r.data ?? []);
}

export interface ServiceItemDetail {
  id: string;
  name: string;
  price: string | number;
  unit?: string | null;
  description?: string | null;
  coverImage?: string | null;
  estimatedDuration?: number | null;
  category?: { id: string; name: string } | null;
}

export function getServiceItem(id: string): Promise<ServiceItemDetail> {
  return api.get(`/services/${id}`).then((r) => r.data);
}

// ---------- 结算（管理端台账 + 师傅收入明细共用类型） ----------
export interface Settlement {
  id: string;
  orderId: string;
  order?: { orderNo?: string; serviceSnapshot?: { name?: string } | null } | null;
  master?: {
    id: string;
    realName?: string;
    user?: { profile?: { nickname?: string | null } } | null;
  } | null;
  orderAmount: string | number;
  platformFee: string | number;
  masterAmount: string | number;
  /** normal=常规单（验收自动入账） compensation=退款补偿单（需管理端审核） */
  type?: 'normal' | 'compensation';
  status: 'pending' | 'credited' | 'rejected' | string;
  note?: string | null;
  createdAt: string;
  settledAt?: string | null;
}
export function getSettlements(): Promise<Settlement[]> {
  return api.get('/settlements').then((r) => r.data ?? []);
}
export function syncSettlements(): Promise<unknown> {
  return api.post('/settlements/sync').then((r) => r.data);
}
/** 补偿单确认入账（pending → credited） */
export function creditSettlement(id: string, note?: string): Promise<Settlement> {
  return api.post(`/settlements/${id}/credit`, { note }).then((r) => r.data);
}
/** 补偿单驳回（pending → rejected，需填原因） */
export function rejectSettlement(id: string, reason: string): Promise<Settlement> {
  return api.post(`/settlements/${id}/reject`, { reason }).then((r) => r.data);
}

// ---------- 师傅收入（汇总 / 明细） ----------
export interface IncomeSummary {
  totalCredited: number; // 累计入账
  monthCredited: number; // 本月入账
  pendingCompensation: number; // 待审核补偿（不计入可提现）
  withdrawing: number; // 提现中（已冻结）
  totalWithdrawn: number; // 累计已提现
  available: number; // 可提现余额
}
export function getMyIncomeSummary(): Promise<IncomeSummary> {
  return api.get('/settlements/summary').then((r) => r.data);
}
export function getMyIncomeDetails(): Promise<Settlement[]> {
  return api.get('/settlements/mine').then((r) => r.data ?? []);
}

// ---------- 提现 ----------
export interface Withdrawal {
  id: string;
  masterId: string;
  amount: string | number;
  channel: 'wechat' | 'alipay' | 'bank' | string;
  account: string;
  status: 'pending' | 'paid' | 'rejected' | string;
  reviewNote?: string | null;
  paidAt?: string | null;
  createdAt: string;
  master?: {
    id: string;
    realName?: string;
    user?: { profile?: { nickname?: string | null } } | null;
  } | null;
}
export function createWithdrawal(dto: {
  amount: number;
  channel: 'wechat' | 'alipay' | 'bank';
  account: string;
}): Promise<Withdrawal> {
  return api.post('/withdrawals', dto).then((r) => r.data);
}
export function getMyWithdrawals(): Promise<Withdrawal[]> {
  return api.get('/withdrawals/mine').then((r) => r.data ?? []);
}
// 管理端
export function getWithdrawals(status?: string): Promise<Withdrawal[]> {
  return api
    .get('/withdrawals', { params: status ? { status } : {} })
    .then((r) => r.data ?? []);
}
export function payWithdrawal(id: string): Promise<Withdrawal> {
  return api.post(`/withdrawals/${id}/pay`).then((r) => r.data);
}
export function rejectWithdrawal(id: string, reason: string): Promise<Withdrawal> {
  return api.post(`/withdrawals/${id}/reject`, { reason }).then((r) => r.data);
}
