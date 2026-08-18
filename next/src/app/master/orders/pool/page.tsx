'use client';

import { PortalNavSetter } from '@/components/PortalShell';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getOrderPool, grabOrder, type OrderLite } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useOrderSocket } from '@/lib/useOrderSocket';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/order-status';
import { StatusBadge } from '@/components/admin/DataTable';
import EmptyState from '@/components/EmptyState';

function addrLine(o: OrderLite) {
  const a = o.address;
  return a ? [a.province, a.city, a.district, a.detail].filter(Boolean).join('') : '-';
}

export default function MasterPoolPage() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [grabTargetId, setGrabTargetId] = useState<string | null>(null);

  const openMap = (addr: string) => {
    const url = `https://api.map.baidu.com/geocoder?address=${encodeURIComponent(addr)}&output=html&src=webapp.baidu.openAPIdemo`;
    window.open(url, '_blank');
  };
  const { data: pool = [], isLoading, refetch } = useQuery({
    queryKey: QK.orderPool,
    queryFn: () => getOrderPool(),
    refetchOnMount: 'always',
  });

  // 实时推送：新订单入池 / 池中订单被接走，均刷新接单池
  useOrderSocket({
    onNewOrder: () => qc.invalidateQueries({ queryKey: QK.orderPool }),
    onOrderUpdate: (o: any) => {
      if (o?.status && o.status !== 'pending_accept') {
        qc.invalidateQueries({ queryKey: QK.orderPool });
      }
    },
  });

  const onGrab = async (id: string) => {
    try {
      await grabOrder(id);
      toast.success('抢单成功，请尽快联系客户');
      qc.invalidateQueries({ queryKey: QK.orderPool });
      qc.invalidateQueries({ queryKey: QK.orderMaster });
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      refetch(); // 手慢了或被接走，刷新池子
    }
  };

  return (
    <>
      <PortalNavSetter
        title="接单池"
        showBack
        backHref="/master"
        onBack={() => {
          if (window.history.length > 1) router.back();
          else router.push('/master');
        }}
        menu={[{ label: '我的订单', href: '/master/orders/mine' }]}
      />
      <div className="laoma-container order-mod">
        {isLoading ? (
          <p className="field-hint">加载中…</p>
        ) : pool.length === 0 ? (
          <div className="card">
            <EmptyState text="暂无待接订单，新订单会实时出现在这里。实时推送已开启。" />
          </div>
        ) : (
          <div className="order-grid">
            {pool.map((o) => (
              <div key={o.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>{o.serviceItem?.name ?? '家政服务'}</div>
                  <span style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}>¥{o.amount}</span>
                </div>
                <div
                  className="field-hint"
                  style={{ marginTop: 6, color: 'var(--color-primary)', cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const a = addrLine(o);
                    if (a !== '-') openMap(a);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const a = addrLine(o);
                      if (a !== '-') openMap(a);
                    }
                  }}
                >
                  📍 {addrLine(o)}
                </div>
                <div className="field-hint">
                  联系人：{o.address?.contactName} {o.address?.contactPhone}
                </div>
                {o.appointmentDate && (
                  <div className="field-hint">
                    预约：
                    {[o.appointmentDate.slice(0, 10), o.appointmentSlot].filter(Boolean).join(' ')}
                  </div>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: 10, width: '100%' }}
                  onClick={() => setGrabTargetId(o.id)}
                >
                  抢单
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    <ConfirmDialog
      open={grabTargetId !== null}
      title="确认接单"
      message="确认抢接该订单吗？接单后请尽快联系客户、按预约时间上门服务。"
      confirmLabel="确认接单"
      onConfirm={() => {
        const id = grabTargetId as string;
        setGrabTargetId(null);
        onGrab(id);
      }}
      onCancel={() => setGrabTargetId(null)}
    />
    </>
  );
}
