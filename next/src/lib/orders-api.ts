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
  createdAt: string;
  serviceItem?: { id: string; name: string; price: string } | null;
  master?: {
    id: string;
    realName?: string;
    user?: { profile?: { nickname?: string | null } } | null;
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
export function cancelMyOrder(id: string): Promise<OrderLite> {
  return api.post(`/orders/${id}/cancel`).then((r) => r.data);
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
export function cancelOrderAdmin(id: string): Promise<OrderLite> {
  return api.post(`/orders/${id}/cancel`).then((r) => r.data);
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

// ---------- 结算台账（管理端） ----------
export interface Settlement {
  id: string;
  orderId: string;
  order?: { orderNo?: string } | null;
  master?: {
    id: string;
    realName?: string;
    user?: { profile?: { nickname?: string | null } } | null;
  } | null;
  orderAmount: string | number;
  platformFee: string | number;
  masterAmount: string | number;
  status: string;
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
export function markSettlementDone(id: string, note?: string): Promise<Settlement> {
  return api.post(`/settlements/${id}/done`, { note }).then((r) => r.data);
}
