'use client';

import { PortalNavSetter } from '@/components/PortalShell';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOrderPool,
  getMasterOrders,
  grabOrder,
  startOrder,
  completeOrder,
  type OrderLite,
} from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/order-status';
import { StatusBadge } from '@/components/admin/DataTable';

// 合并接单池与我的订单：被我抢到的订单会同时出现在两处，按 id 去重（以我的那份为准，含 master 字段）
function combine(pool: OrderLite[] = [], mine: OrderLite[] = []): OrderLite[] {
  const map = new Map<string, OrderLite>();
  [...pool, ...mine].forEach((o) => map.set(o.id, o));
  return [...map.values()];
}

export default function MasterOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const poolQ = useQuery({
    queryKey: QK.orderPool,
    queryFn: () => getOrderPool(),
    refetchOnMount: 'always',
  });
  const mineQ = useQuery({
    queryKey: QK.orderMaster,
    queryFn: () => getMasterOrders(),
    refetchOnMount: 'always',
  });

  const isLoading = poolQ.isLoading || mineQ.isLoading;
  const order = combine(poolQ.data, mineQ.data).find((o) => o.id === id);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: QK.orderPool });
    qc.invalidateQueries({ queryKey: QK.orderMaster });
  };

  const onGrab = async () => {
    try {
      await grabOrder(id);
      toast.success('抢单成功，请尽快联系客户');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      refresh(); // 手慢了或被接走，刷新状态
    }
  };
  const onStart = async () => {
    try {
      await startOrder(id);
      toast.success('已上门，开始服务');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };
  const onComplete = async () => {
    try {
      await completeOrder(id);
      toast.success('服务已完成，等待客户验收');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };

  if (isLoading) {
    return (
      <>
        <PortalNavSetter title="订单详情" showBack backHref="/master/orders/pool" />
        <div className="laoma-container">
          <p className="field-hint">加载中…</p>
        </div>
      </>
    );
  }
  if (!order) {
    return (
      <>
        <PortalNavSetter title="订单详情" showBack backHref="/master/orders/pool" />
        <div className="laoma-container">
          <div className="card">
            <p className="field-hint">未找到该订单，可能已被他人接走。</p>
          </div>
        </div>
      </>
    );
  }

  const isPoolOrder = order.status === 'pending_accept' && !order.master;
  const backHref = isPoolOrder ? '/master/orders/pool' : '/master/orders/mine';
  const addr = order.address;
  const addrLine = addr
    ? [addr.province, addr.city, addr.district, addr.detail].filter(Boolean).join('')
    : '-';

  return (
    <>
      <PortalNavSetter title="订单详情" showBack backHref={backHref} />
      <div className="laoma-container">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{order.serviceItem?.name ?? '家政服务'}</h2>
            <StatusBadge tone={ORDER_STATUS_TONE[order.status]}>
              {ORDER_STATUS_LABEL[order.status]}
            </StatusBadge>
          </div>
          <p className="field-hint" style={{ marginTop: 4 }}>单号 {order.orderNo}</p>

          <div className="field-inline-row" style={{ marginTop: 12 }}>
            <span className="field-label">金额</span>
            <span
              className="field-inline-value"
              style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}
            >
              ¥{order.amount}
            </span>
          </div>
          <div className="field-inline-row">
            <span className="field-label">服务地址</span>
            <span className="field-inline-value">{addrLine}</span>
          </div>
          <div className="field-inline-row">
            <span className="field-label">联系人</span>
            <span className="field-inline-value">
              {addr ? `${addr.contactName} ${addr.contactPhone}` : '-'}
            </span>
          </div>
          <div className="field-inline-row">
            <span className="field-label">预约时间</span>
            <span className="field-inline-value">
              {[order.appointmentDate?.slice(0, 10), order.appointmentSlot].filter(Boolean).join(' ') || '-'}
            </span>
          </div>
          {order.remark && (
            <div className="field-inline-row">
              <span className="field-label">备注</span>
              <span className="field-inline-value">{order.remark}</span>
            </div>
          )}
          {order.master && (
            <div className="field-inline-row">
              <span className="field-label">接单师傅</span>
              <span className="field-inline-value">
                {order.master.realName ?? order.master.user?.profile?.nickname ?? '-'}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {isPoolOrder && (
            <button type="button" className="btn-primary" onClick={onGrab}>
              抢单
            </button>
          )}
          {order.master && order.status === 'accepted' && (
            <button type="button" className="btn-primary" onClick={onStart}>
              开始服务（上门）
            </button>
          )}
          {order.status === 'servicing' && (
            <button type="button" className="btn-primary" onClick={onComplete}>
              完成服务
            </button>
          )}
          {order.status === 'pending_confirm' && (
            <p className="field-hint" style={{ textAlign: 'center' }}>
              服务已完成，等待客户验收
            </p>
          )}
          {(order.status === 'reviewed' ||
            order.status === 'refunding' ||
            order.status === 'refunded' ||
            order.status === 'cancelled') && (
            <p className="field-hint" style={{ textAlign: 'center' }}>
              {ORDER_STATUS_LABEL[order.status]}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
