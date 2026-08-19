'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getAllOrders, type OrderLite } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/order-status';
import { StatusBadge } from '@/components/admin/DataTable';
import EmptyState from '@/components/EmptyState';
import { formatDateTime } from '@/lib/format';

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const orderId = Array.isArray(id) ? id[0] : id;

  const { data: orders = [], isLoading } = useQuery<OrderLite[]>({
    queryKey: QK.orderAll,
    queryFn: () => getAllOrders(),
    refetchOnMount: 'always',
  });
  const order = orders.find((o) => o.id === orderId);

  const addr = order?.address;
  const addrLine = addr
    ? [addr.province, addr.city, addr.district, addr.detail].filter(Boolean).join('')
    : '-';

  return (
    <div className="admin-detail-page">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <Link href="/admin/orders/all" className="nav-link">
          ← 返回订单列表
        </Link>
        <h2 style={{ margin: '4px 0 0', fontSize: 18 }}>订单详情</h2>
      </div>

      {isLoading ? (
        <p className="field-hint">加载中…</p>
      ) : !order ? (
        <div className="card">
          <EmptyState text="未找到该订单。" />
        </div>
      ) : (
        <div className="admin-detail-grid">
          {/* 基本信息 */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{order.serviceItem?.name ?? '家政服务'}</h2>
              <StatusBadge tone={ORDER_STATUS_TONE[order.status]}>
                {ORDER_STATUS_LABEL[order.status]}
              </StatusBadge>
            </div>
            <p className="field-hint" style={{ marginTop: 4 }}>单号 {order.orderNo}</p>
            <div className="field-inline-row" style={{ marginTop: 10 }}>
              <span className="field-label">金额</span>
              <span className="field-inline-value" style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}>
                ¥{order.amount}
              </span>
            </div>
            <div className="field-inline-row">
              <span className="field-label">下单时间</span>
              <span className="field-inline-value">{formatDateTime(order.createdAt)}</span>
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
            {order.cancelReason && (
              <div className="field-inline-row">
                <span className="field-label">取消原因</span>
                <span className="field-inline-value">{order.cancelReason}</span>
              </div>
            )}
          </div>

          {/* 客户信息 */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>客户信息</div>
            <div className="field-inline-row">
              <span className="field-label">昵称</span>
              <span className="field-inline-value">{order.customer?.profile?.nickname ?? '-'}</span>
            </div>
            <div className="field-inline-row">
              <span className="field-label">电话</span>
              <span className="field-inline-value">{order.customer?.phone ?? '-'}</span>
            </div>
          </div>

          {/* 服务地址 */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>服务地址</div>
            <div className="field-inline-row">
              <span className="field-label">地址</span>
              <span className="field-inline-value">{addrLine}</span>
            </div>
            <div className="field-inline-row">
              <span className="field-label">联系人</span>
              <span className="field-inline-value">{addr?.contactName ?? '-'}</span>
            </div>
            <div className="field-inline-row">
              <span className="field-label">联系电话</span>
              <span className="field-inline-value">{addr?.contactPhone ?? '-'}</span>
            </div>
          </div>

          {/* 接单师傅 */}
          {order.master && (
            <div className="card">
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>接单师傅</div>
              <div className="field-inline-row">
                <span className="field-label">姓名</span>
                <span className="field-inline-value">
                  {order.master.realName ?? order.master.user?.profile?.nickname ?? '-'}
                </span>
              </div>
              <div className="field-inline-row">
                <span className="field-label">电话</span>
                <span className="field-inline-value">{order.master.user?.phone ?? '-'}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
