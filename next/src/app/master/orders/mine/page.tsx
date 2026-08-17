'use client';

import { PortalNavSetter } from '@/components/PortalShell';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getMasterOrders } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/order-status';
import { StatusBadge } from '@/components/admin/DataTable';

export default function MasterMinePage() {
  const router = useRouter();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: QK.orderMaster,
    queryFn: () => getMasterOrders(),
    refetchOnMount: 'always',
  });

  return (
    <>
      <PortalNavSetter
        title="我的订单"
        showBack
        backHref="/master"
        onBack={() => {
          if (window.history.length > 1) router.back();
          else router.push('/master');
        }}
        menu={[{ label: '接单池', href: '/master/orders/pool' }]}
      />
      <div className="laoma-container order-mod">
        {isLoading ? (
          <p className="field-hint">加载中…</p>
        ) : orders.length === 0 ? (
          <div className="card">
            <p className="field-hint" style={{ textAlign: 'center' }}>还没有接单，去接单池看看吧。</p>
          </div>
        ) : (
          <div className="order-grid">
            {orders.map((o) => {
              const addr = o.address;
              const addrLine = addr
                ? [addr.province, addr.city, addr.district, addr.detail].filter(Boolean).join('')
                : '';
              return (
              <Link
                key={o.id}
                href={`/master/orders/${o.id}`}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: 'var(--color-text-soft)', fontSize: 12 }}>
                  <span>下单 {(o.createdAt || '').slice(0, 10)}</span>
                  <span>
                    {(o.appointmentDate?.slice(0, 10) || '未约')}
                    {o.appointmentSlot ? ` ${o.appointmentSlot}` : ''}
                  </span>
                </div>
                {addrLine && (
                  <div style={{ marginTop: 4, color: 'var(--color-muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📍 {addrLine}
                  </div>
                )}
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
