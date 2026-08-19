'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWithdrawals,
  payWithdrawal,
  rejectWithdrawal,
  type Withdrawal,
} from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import DataTable, { type Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Modal } from '@/components/Modal';
import { Textarea } from '@/components/form/Textarea';
import { formatDateTime } from '@/lib/format';

const WD_STATUS: Record<
  string,
  { label: string; tone: 'orange' | 'green' | 'gray' }
> = {
  pending: { label: '待审核', tone: 'orange' },
  paid: { label: '已打款', tone: 'green' },
  rejected: { label: '已驳回', tone: 'gray' },
};

const CHANNEL_LABEL: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  bank: '银行卡',
};

function maskAccount(acc: string) {
  if (!acc) return '-';
  if (acc.length <= 4) return acc;
  return acc.slice(0, 2) + '****' + acc.slice(-3);
}

export default function AdminWithdrawalsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmPay, setConfirmPay] = useState<Withdrawal | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);

  const { data: list = [], isLoading } = useQuery<Withdrawal[]>({
    queryKey: [...QK.adminWithdrawals, statusFilter],
    queryFn: () => getWithdrawals(statusFilter || undefined),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: QK.adminWithdrawals });

  const confirmPayDone = async () => {
    if (!confirmPay) return;
    setActing(true);
    try {
      await payWithdrawal(confirmPay.id);
      toast.success('已标记打款');
      setConfirmPay(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setActing(false);
    }
  };

  const openReject = (w: Withdrawal) => {
    setRejectTarget(w);
    setRejectReason('');
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error('请填写驳回原因');
      return;
    }
    setActing(true);
    try {
      await rejectWithdrawal(rejectTarget.id, rejectReason.trim());
      toast.success('已驳回，金额解冻退回师傅余额');
      setRejectTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setActing(false);
    }
  };

  const columns = useMemo<Column<Withdrawal>[]>(
    () => [
      {
        key: 'master',
        title: '师傅',
        width: '120px',
        render: (w) =>
          w.master?.realName ?? w.master?.user?.profile?.nickname ?? '-',
      },
      {
        key: 'amount',
        title: '提现金额',
        width: '110px',
        align: 'right',
        render: (w) => <span style={{ fontWeight: 600 }}>¥{w.amount}</span>,
      },
      {
        key: 'channel',
        title: '收款渠道',
        width: '90px',
        render: (w) => CHANNEL_LABEL[w.channel] ?? w.channel,
      },
      {
        key: 'account',
        title: '收款账号',
        width: '160px',
        render: (w) => maskAccount(w.account),
      },
      {
        key: 'status',
        title: '状态',
        width: '90px',
        render: (w) => {
          const m = WD_STATUS[w.status] ?? { label: w.status, tone: 'gray' as const };
          return <StatusBadge tone={m.tone}>{m.label}</StatusBadge>;
        },
      },
      {
        key: 'createdAt',
        title: '申请时间',
        width: '160px',
        render: (w) =>
          formatDateTime(w.createdAt),
      },
      {
        key: 'note',
        title: '备注',
        render: (w) => {
          if (w.status === 'rejected' && w.reviewNote) return w.reviewNote;
          if (w.status === 'paid' && w.paidAt)
            return `打款 ${formatDateTime(w.paidAt)}`;
          return <span className="field-hint">—</span>;
        },
      },
      {
        key: 'op',
        title: '操作',
        width: '260px',
        render: (w) =>
          w.status === 'pending' ? (
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <button
                type="button"
                className="btn-link"
                onClick={() => setConfirmPay(w)}
              >
                标记打款
              </button>
              <button
                type="button"
                className="btn-link btn-link-danger"
                onClick={() => openReject(w)}
              >
                驳回
              </button>
            </span>
          ) : (
            <span className="field-hint">—</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const FILTERS = [
    { label: '全部', value: '' },
    { label: '待审核', value: 'pending' },
    { label: '已打款', value: 'paid' },
    { label: '已驳回', value: 'rejected' },
  ];

  return (
    <>
      <div className="page-head">
        <h2>提现管理</h2>
      </div>

      <p className="field-hint" style={{ marginTop: -4, marginBottom: 12 }}>
        审核通过后请线下打款，再点「标记打款」；驳回需填原因，金额自动解冻退回师傅余额。
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`radio-pill ${statusFilter === f.value ? 'radio-pill-active' : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={list}
        rowKey={(w) => w.id}
        loading={isLoading}
        emptyText="暂无提现申请"
      />

      <ConfirmDialog
        open={!!confirmPay}
        title="标记打款"
        message={`请确认已通过线下渠道将 ¥${
          confirmPay ? Number(confirmPay.amount).toFixed(2) : ''
        } 打款给师傅（${
          confirmPay
            ? confirmPay.master?.realName ??
              confirmPay.master?.user?.profile?.nickname ??
              ''
            : ''
        }），并保留转账凭证。`}
        confirmLabel="确认已打款"
        loading={acting}
        onCancel={() => setConfirmPay(null)}
        onConfirm={confirmPayDone}
      />

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="驳回提现申请"
      >
        <div className="field-label" style={{ marginBottom: 6 }}>驳回原因（必填）</div>
        <Textarea
          rows={3}
          maxLength={200}
          placeholder="请填写驳回原因，师傅端可见"
          value={rejectReason}
          onChange={(e: any) => setRejectReason(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setRejectTarget(null)}
          >
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={acting}
            onClick={submitReject}
          >
            {acting ? '提交中…' : '确认驳回'}
          </button>
        </div>
      </Modal>
    </>
  );
}
