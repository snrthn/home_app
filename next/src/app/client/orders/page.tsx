'use client';

import { PortalNavSetter } from '@/components/PortalShell';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getMyOrders } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/order-status';
import { StatusBadge } from '@/components/admin/DataTable';

export default function ClientOrdersPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: QK.orderMine,
    queryFn: getMyOrders,
    refetchOnMount: 'always',
  });

  return (
    <>
      <PortalNavSetter title="我的订单" showBack backHref="/client/me" />
      <div className="laoma-container">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>我的订单</h2>
          <Link href="/client/orders/new" className="btn-primary btn-md" style={{ marginLeft: 'auto' }}>
            + 去下单
          </Link>
        </div>

        {isLoading ? (
          <p className="field-hint">加载中…</p>
        ) : orders.length === 0 ? (
          <div className="card">
            <p className="field-hint">还没有订单，去下一单吧。</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/client/orders/${o.id}`}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>{o.serviceItem?.name ?? '家政服务'}</div>
                  <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>
                    {ORDER_STATUS_LABEL[o.status]}
                  </StatusBadge>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 6,
                    color: 'var(--color-text-soft)',
                    fontSize: 13,
                  }}
                >
                  <span>单号 {o.orderNo}</span>
                  <span style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}>¥{o.amount}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
