'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllOrders, assignOrder, cancelOrderAdmin, type OrderLite } from '@/lib/orders-api';
import { getMasters, type MasterUser } from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useEscClose } from '@/lib/useEscClose';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderStatus } from '@/lib/order-status';
import DataTable, { type Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/DataTable';
import { Modal } from '@/components/Modal';

// 管理端可指派的状态（尚未分配给具体师傅）
const ASSIGNABLE = new Set<OrderStatus>(['pending_payment', 'pending_accept']);
// 管理端可取消的状态（终态不可取消）
const CANCELABLE = new Set<OrderStatus>([
  'pending_payment',
  'pending_accept',
  'accepted',
  'departing',
  'arrived',
  'servicing',
  'pending_confirm',
]);

// 订单列表（管理端复用）：按状态子集过滤。
// statuses 不传 = 全部订单；传入则只展示对应状态（如「待接订单」「正在服务」）。
export default function OrdersTable({
  title,
  statuses,
}: {
  title: string;
  statuses?: OrderStatus[];
}) {
  const toast = useToast();
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<OrderLite[]>({
    queryKey: QK.orderAll,
    queryFn: () => getAllOrders(),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const rows = useMemo(
    () => (statuses && statuses.length ? orders.filter((o) => statuses.includes(o.status)) : orders),
    [orders, statuses],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: QK.orderAll });

  // ---- 指派弹窗 ----
  const [assignTarget, setAssignTarget] = useState<OrderLite | null>(null);
  const [masters, setMasters] = useState<MasterUser[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [acting, setActing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OrderLite | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const openAssign = async (o: OrderLite) => {
    setAssignTarget(o);
    setSelectedMasterId('');
    try {
      const list = await getMasters({ status: 'active' });
      setMasters(list);
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };
  const closeAssign = () => setAssignTarget(null);
  useEscClose(closeAssign);

  const confirmAssign = async () => {
    if (!assignTarget || !selectedMasterId) return;
    setActing(true);
    try {
      await assignOrder(assignTarget.id, selectedMasterId);
      toast.success('已指派师傅');
      closeAssign();
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setActing(false);
    }
  };

  // ---- 取消 ----
  const onCancelClick = (o: OrderLite) => {
    setCancelTarget(o);
    setCancelReason('');
  };
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error('请填写取消原因');
      return;
    }
    setActing(true);
    try {
      await cancelOrderAdmin(cancelTarget.id, reason);
      toast.success('订单已取消');
      setCancelTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setActing(false);
    }
  };

  const columns = useMemo<Column<OrderLite>[]>(
    () => [
      { key: 'orderNo', title: '单号', width: '150px' },
      {
        key: 'service',
        title: '服务',
        width: '200px',
        render: (o) => o.serviceItem?.name ?? '家政服务',
      },
      {
        key: 'customer',
        title: '客户',
        width: '120px',
        render: (o) => o.customer?.profile?.nickname ?? o.customer?.phone ?? '-',
      },
      {
        key: 'master',
        title: '师傅',
        width: '120px',
        render: (o) =>
          o.master ? o.master.realName ?? o.master.user?.profile?.nickname ?? '-' : '—',
      },
      {
        key: 'amount',
        title: '金额',
        width: '100px',
        align: 'right',
        render: (o) => <span style={{ fontWeight: 600 }}>¥{o.amount}</span>,
      },
      {
        key: 'status',
        title: '状态',
        width: '100px',
        render: (o) => (
          <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</StatusBadge>
        ),
      },
      {
        key: 'appointment',
        title: '预约',
        width: '150px',
        render: (o) =>
          [o.appointmentDate?.slice(0, 10), o.appointmentSlot].filter(Boolean).join(' ') || '-',
      },
      {
        key: 'op',
        title: '操作',
        width: '220px',
        render: (o) => (
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/admin/orders/${o.id}`} className="btn-link">
              查看
            </Link>
            {ASSIGNABLE.has(o.status) && (
              <button type="button" className="btn-link" onClick={() => openAssign(o)}>
                指派
              </button>
            )}
            {CANCELABLE.has(o.status) && (
              <button type="button" className="btn-link btn-link-danger" onClick={() => onCancelClick(o)}>
                取消
              </button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <div className="page-head">
        <h2>{title}</h2>
        <span className="page-sub">共 {rows.length} 单</span>
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(o) => o.id} loading={isLoading} emptyText="暂无订单" />

      {assignTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-panel modal-md">
            <div className="modal-header">
              <span>指派师傅</span>
              <button type="button" className="modal-close" onClick={closeAssign} aria-label="关闭">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0 }}>
                订单 <b>{assignTarget.orderNo}</b> · {assignTarget.serviceItem?.name ?? '家政服务'}
              </p>
              <label className="field-label" htmlFor="assign-master">选择师傅</label>
              <select
                id="assign-master"
                className="input"
                value={selectedMasterId}
                onChange={(e) => setSelectedMasterId(e.target.value)}
              >
                <option value="">请选择师傅</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.realName}
                    {m.user?.phone ? `（${m.user.phone}）` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeAssign} disabled={acting}>
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmAssign}
                disabled={acting || !selectedMasterId}
              >
                {acting ? '指派中…' : '确认指派'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={!!cancelTarget}
        onClose={() => {
          if (!acting) setCancelTarget(null);
        }}
        title="取消订单"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setCancelTarget(null)} disabled={acting}>
              再想想
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={confirmCancel}
              disabled={acting || !cancelReason.trim()}
            >
              {acting ? '取消中…' : '确认取消'}
            </button>
          </>
        }
      >
        <p style={{ marginTop: 0 }}>
          确定取消订单 {cancelTarget?.orderNo ?? ''} 吗？取消后订单将关闭
          {cancelTarget?.status && cancelTarget.status !== 'pending_payment'
            ? `，${
                cancelTarget.status === 'departing'
                  ? '师傅已出发，将退款 80%'
                  : cancelTarget.status === 'arrived'
                    ? '师傅已到达，将退款 50%'
                    : '若已支付将全额退款'
              }`
            : '（未支付，无退款）'}
          。
        </p>
        <label className="field-label" htmlFor="admin-cancel-reason">
          取消原因 <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <textarea
          id="admin-cancel-reason"
          className="input"
          value={cancelReason}
          maxLength={200}
          placeholder="请填写取消原因，如：客户申请取消 / 师傅无法履约 / 风险订单管控…"
          onChange={(e) => setCancelReason(e.target.value)}
          disabled={acting}
          style={{ width: '100%', minHeight: 80, resize: 'vertical' }}
        />
        <p className="field-hint" style={{ margin: '6px 0 0' }}>
          取消原因将记录在订单日志中，便于后续追溯（必填，200 字以内）
        </p>
      </Modal>
    </>
  );
}
