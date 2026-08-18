'use client';

import OrdersTable from '@/components/admin/OrdersTable';
import type { OrderStatus } from '@/lib/order-status';

// 待接订单：已支付、资金托管在平台、等待师傅抢单或运营派单。
const PENDING: OrderStatus[] = ['pending_accept'];

export default function AdminPendingPage() {
  return <OrdersTable title="待接订单" statuses={PENDING} />;
}
