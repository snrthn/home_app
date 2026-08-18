'use client';

import OrdersTable from '@/components/admin/OrdersTable';

// 全部订单：全量列表（含指派 / 取消操作）。
export default function AdminOrdersAllPage() {
  return <OrdersTable title="全部订单" />;
}
