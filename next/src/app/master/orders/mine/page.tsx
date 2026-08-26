'use client';

import { useState, useCallback } from 'react';
import { PortalNavSetter, StickyTabsSetter } from '@/components/PortalShell';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMasterOrders } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, MASTER_ORDER_TABS } from '@/lib/order-status';
import { StatusBadge } from '@/components/admin/DataTable';
import EmptyState from '@/components/EmptyState';
import { formatDateTime } from '@/lib/format';
import { CopyButton } from '@/components/CopyText';

export default function MasterMinePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState('all');
  const onTabChange = useCallback((key: string) => setTab(key), []);
  const { data: orders = [], isLoading } = useQuery({
    queryKey: QK.orderMaster,
    queryFn: () => getMasterOrders(),
    refetchOnMount: 'always',
  });

  // 各分类数量（角标）；statuses=null 为全部
  const counts = MASTER_ORDER_TABS.map((t) => ({
    ...t,
    count: t.statuses ? orders.filter((o) => t.statuses!.includes(o.status)).length : orders.length,
  }));
  const activeDef = MASTER_ORDER_TABS.find((t) => t.key === tab) ?? MASTER_ORDER_TABS[0];
  const filtered = activeDef.statuses
    ? orders.filter((o) => activeDef.statuses!.includes(o.status))
    : orders;

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
        menu={[
          { label: '接单池', href: '/master/orders/pool' },
          { label: '刷新数据', dividerBefore: true, onClick: () => qc.invalidateQueries({ queryKey: QK.orderMaster }) },
        ]}
      />
      <StickyTabsSetter
        tabs={counts.map(({ key, label, count }) => ({ key, label, count: key === 'all' ? 0 : count }))}
        active={tab}
        onChange={onTabChange}
        ariaLabel="订单状态筛选"
        visible
      />
      <div className="laoma-container order-mod">
        {isLoading ? (
          <p className="field-hint">加载中…</p>
        ) : filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              text={
                tab === 'all'
                  ? '还没有接单，去接单池看看吧。'
                  : `暂无「${activeDef.label}」订单。`
              }
            />
          </div>
        ) : (
          <div className="order-grid">
            {filtered.map((o) => {
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
                  <span>单号 {o.orderNo}<CopyButton value={o.orderNo} title="复制订单号" /></span>
                  <span style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}>¥{o.amount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: 'var(--color-text-soft)', fontSize: 12 }}>
                  <span>下单 {formatDateTime(o.createdAt)}</span>
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
