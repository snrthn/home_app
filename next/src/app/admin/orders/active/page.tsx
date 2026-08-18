'use client';

import OrdersTable from '@/components/admin/OrdersTable';
import type { OrderStatus } from '@/lib/order-status';

// 正在服务：已接单、服务中、待验收（在途服务监控）。
const ACTIVE: OrderStatus[] = ['accepted', 'servicing', 'pending_confirm'];

export default function AdminActivePage() {
  return <OrdersTable title="正在服务" statuses={ACTIVE} />;
}
