'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import DataTable, { type Column, StatusBadge } from '@/components/admin/DataTable';
import { Modal } from '@/components/Modal';
import { Field } from '@/components/form/Field';
import { formatDateTime } from '@/lib/format';
import {
  getRefunds,
  approveRefund,
  rejectRefund,
  type RefundItem,
  type RefundStatus,
  REFUND_STATUS_LABEL,
  REFUND_STATUS_TONE,
} from '@/lib/refunds-api';

const STATUS_OPTIONS: RefundStatus[] = ['pending_review', 'approved', 'rejected'];

const money = (v?: string | number | null) =>
  v == null || v === '' ? '-' : `¥${Number(v).toFixed(2)}`;

export default function AdminRefundPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<RefundStatus | ''>('');
  const [kw, setKw] = useState('');
  const [orderNo, setOrderNo] = useState('');
  // 审核弹窗：approve / reject 共用，独立于列表
  const [review, setReview] = useState<{ item: RefundItem; action: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const { data: list = [], isLoading } = useQuery<RefundItem[]>({
    queryKey: ['admin-refunds', status, orderNo],
    queryFn: () => getRefunds({ status: status || undefined, orderNo: orderNo || undefined }),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const pendingCount = useMemo(
    () => list.filter((r) => r.status === 'pending_review').length,
    [list],
  );

  const openReview = (item: RefundItem, action: 'approve' | 'reject') => {
    setReview({ item, action });
    setNote('');
    setErr('');
  };

  const doReview = async () => {
    if (!review) return;
    // 驳回必须写明原因（会写入工单内部备注供客服回溯）
    if (review.action === 'reject' && !note.trim()) {
      setErr('请填写驳回原因');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      if (review.action === 'approve') {
        await approveRefund(review.item.id, note.trim() || undefined);
        toast.success('已通过，退款执行中');
      } else {
        await rejectRefund(review.item.id, note.trim());
        toast.success('已驳回');
      }
      setReview(null);
      qc.invalidateQueries({ queryKey: ['admin-refunds'] });
    } catch (e: any) {
      setErr(getApiErrorMsg(e));
      setBusy(false);
    }
  };

  const columns = useMemo<Column<RefundItem>[]>(
    () => [
      { key: 'refundNo', title: '退款单号', width: '150px' },
      {
        key: 'order',
        title: '关联订单',
        width: '150px',
        render: (r) => r.order?.orderNo ?? '-',
      },
      {
        key: 'customer',
        title: '客户',
        width: '140px',
        render: (r) =>
          r.order?.customer
            ? r.order.customer.profile?.nickname || r.order.customer.phone || '-'
            : '-',
      },
      {
        key: 'amount',
        title: '申请金额',
        width: '110px',
        align: 'right',
        render: (r) => <span style={{ fontWeight: 600 }}>{money(r.amount)}</span>,
      },
      {
        key: 'status',
        title: '状态',
        width: '100px',
        render: (r) => (
          <StatusBadge tone={REFUND_STATUS_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status]}</StatusBadge>
        ),
      },
      {
        key: 'reason',
        title: '原因',
        render: (r) => (
          <span className="cell-ellipsis" title={r.reason ?? ''}>
            {r.reason ?? '-'}
          </span>
        ),
      },
      {
        key: 'requestedBy',
        title: '发起人',
        width: '110px',
        render: (r) => r.requestedBy?.phone ?? '-',
      },
      {
        key: 'reviewed',
        title: '审核',
        width: '170px',
        render: (r) =>
          r.status === 'pending_review' ? (
            <span className="field-hint">待审核</span>
          ) : (
            <div>
              <div>{r.reviewedBy?.phone ?? '-'}</div>
              <div className="field-hint">{r.reviewedAt ? formatDateTime(r.reviewedAt) : ''}</div>
            </div>
          ),
      },
      {
        key: 'refundedAmount',
        title: '实退金额',
        width: '100px',
        align: 'right',
        render: (r) => money(r.refundedAmount),
      },
      {
        key: 'createdAt',
        title: '申请时间',
        width: '160px',
        render: (r) => formatDateTime(r.createdAt),
      },
      {
        key: '_actions',
        title: '操作',
        width: '140px',
        render: (r) =>
          r.status === 'pending_review' ? (
            <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
              <button type="button" className="btn-link" onClick={() => openReview(r, 'approve')}>
                通过
              </button>
              <button type="button" className="btn-link" onClick={() => openReview(r, 'reject')}>
                驳回
              </button>
            </div>
          ) : (
            <span className="field-hint">-</span>
          ),
      },
    ],
    [],
  );

  const reviewFooter = review ? (
    review.action === 'approve' ? (
      <>
        <button className="btn-secondary" disabled={busy} onClick={() => setReview(null)}>
          取消
        </button>
        <button className="btn-primary" disabled={busy} onClick={doReview}>
          确认通过
        </button>
      </>
    ) : (
      <>
        <button className="btn-secondary" disabled={busy} onClick={() => setReview(null)}>
          取消
        </button>
        <button className="btn-danger" disabled={busy} onClick={doReview}>
          确认驳回
        </button>
      </>
    )
  ) : null;

  return (
    <>
      <div className="page-head">
        <h2>退款/售后</h2>
        <span className="field-hint">
          投诉处置退款申请台账 · 待审核 {pendingCount} 条，通过后执行阶梯退款
        </span>
      </div>

      <div className="filter-bar">
        <select
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value as RefundStatus | '')}
        >
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{REFUND_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <input
          className="input"
          placeholder="按订单号搜索"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setOrderNo(kw.trim())}
        />
        <button className="btn-ghost" onClick={() => setOrderNo(kw.trim())}>
          查询
        </button>
        <button className="btn-ghost" onClick={() => qc.invalidateQueries({ queryKey: ['admin-refunds'] })}>
          刷新
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={list}
        rowKey={(r) => r.id}
        loading={isLoading}
        emptyText="暂无退款申请"
      />

      {review && (
        <Modal
          open
          onClose={() => !busy && setReview(null)}
          title={`${review.item.refundNo} · ${review.action === 'approve' ? '通过退款' : '驳回退款'}`}
          width="md"
          footer={reviewFooter}
        >
          <div className="ticket-meta" style={{ marginBottom: 16 }}>
            <div>
              <span>关联订单</span>
              <b>{review.item.order?.orderNo ?? '-'}</b>
            </div>
            <div>
              <span>客户</span>
              <b>
                {review.item.order?.customer
                  ? review.item.order.customer.profile?.nickname ||
                    review.item.order.customer.phone ||
                    '-'
                  : '-'}
              </b>
            </div>
            <div>
              <span>申请金额</span>
              <b>{money(review.item.amount)}</b>
            </div>
            <div>
              <span>发起原因</span>
              <b>{review.item.reason ?? '-'}</b>
            </div>
          </div>

          <Field label={review.action === 'reject' ? '驳回原因（必填，写入工单内部备注）' : '审核备注（选填）'}>
            <textarea
              className="textarea"
              rows={3}
              placeholder={review.action === 'reject' ? '驳回原因…' : '审核备注…'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>

          {review.action === 'approve' && (
            <div className="field-hint">通过后将执行阶梯退款（已完单投诉订单同样放行），并回填实退金额。</div>
          )}
          {err && <div className="form-msg">{err}</div>}
        </Modal>
      )}
    </>
  );
}
