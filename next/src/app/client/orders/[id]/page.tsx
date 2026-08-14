'use client';

import { useState } from 'react';
import { PortalNavSetter } from '@/components/PortalShell';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyOrders, payByMock, confirmOrder, cancelMyOrder } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderStatus } from '@/lib/order-status';
import { StatusBadge } from '@/components/admin/DataTable';

// 可取消的状态：支付前取消无退款；支付后取消走退款
const CANCELABLE: OrderStatus[] = [
  'pending_payment',
  'pending_accept',
  'accepted',
  'servicing',
  'pending_confirm',
];

export default function ClientOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: QK.orderMine,
    queryFn: getMyOrders,
    refetchOnMount: 'always',
  });
  const order = orders.find((o) => o.id === id);

  const refresh = () => qc.invalidateQueries({ queryKey: QK.orderMine });

  const onPay = async () => {
    try {
      await payByMock(id);
      toast.success('支付成功，等待师傅接单');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };
  const onConfirm = async () => {
    try {
      await confirmOrder(id);
      toast.success('已确认验收，托管金已释放给师傅');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };
  const confirmCancel = async () => {
    try {
      await cancelMyOrder(id);
      toast.success('订单已取消');
      setCancelOpen(false);
      refresh();
      router.replace('/client/orders');
    } catch (e: any) {
      setCancelOpen(false);
      toast.error(getApiErrorMsg(e));
    }
  };

  if (isLoading) return <><PortalNavSetter title="订单详情" showBack backHref="/client/orders" /><div className="laoma-container"><p className="field-hint">加载中…</p></div></>;
  if (!order) return <><PortalNavSetter title="订单详情" showBack backHref="/client/orders" /><div className="laoma-container"><div className="card"><p className="field-hint">未找到该订单。</p></div></div></>;

  const addr = order.address;
  const addrLine = addr
    ? [addr.province, addr.city, addr.district, addr.detail].filter(Boolean).join('')
    : '-';

  return (
    <>
      <PortalNavSetter title="订单详情" showBack backHref="/client/orders" />
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
            <span className="field-inline-value" style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}>
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
          {order.status === 'pending_payment' && (
            <button type="button" className="btn-primary" onClick={onPay}>
              去支付（模拟）
            </button>
          )}
          {order.status === 'pending_confirm' && (
            <button type="button" className="btn-primary" onClick={onConfirm}>
              确认验收
            </button>
          )}
          {order.status !== 'cancelled' && order.status !== 'refunded' && order.status !== 'refunding' && (
            <button type="button" className="btn-danger" onClick={() => setCancelOpen(true)}>
              {CANCELABLE.includes(order.status)
                ? order.status === 'pending_payment'
                  ? '取消订单'
                  : '申请取消（退款）'
                : '取消订单'}
            </button>
          )}
          {(order.status === 'refunding' || order.status === 'refunded' || order.status === 'cancelled') && (
            <p className="field-hint" style={{ textAlign: 'center' }}>
              {ORDER_STATUS_LABEL[order.status]}（资金状态以平台为准）
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title={CANCELABLE.includes(order.status) ? '取消订单确认' : '暂不可取消'}
        message={
          CANCELABLE.includes(order.status)
            ? `订单「${order.orderNo}」当前为「${ORDER_STATUS_LABEL[order.status]}」，取消后${
                order.status === 'pending_payment' ? '未支付、不产生退款' : '已支付的托管金将原路退回'
              }。确定取消吗？`
            : `订单当前为「${ORDER_STATUS_LABEL[order.status]}」，已完成验收且托管金已结算给师傅，平台不支持取消。如仍有异议：① 可在「我的-我的评价」追加评价；② 拨打客服热线 400-000-0000 协商售后；③ 客服工单系统建设中，后续可在「我的-帮助中心」提交工单。`
        }
        confirmLabel={CANCELABLE.includes(order.status) ? '确认取消' : '我知道了'}
        onConfirm={CANCELABLE.includes(order.status) ? confirmCancel : () => setCancelOpen(false)}
        onCancel={() => setCancelOpen(false)}
      />
    </>
  );
}
