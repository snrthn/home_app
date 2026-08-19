'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSettlements,
  syncSettlements,
  creditSettlement,
  rejectSettlement,
  type Settlement,
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
import { CopyButton } from '@/components/CopyText';

const SETTLEMENT_STATUS: Record<
  string,
  { label: string; tone: 'green' | 'orange' | 'gray' }
> = {
  pending: { label: '待审核', tone: 'orange' },
  credited: { label: '已入账', tone: 'green' },
  rejected: { label: '已驳回', tone: 'gray' },
};

export default function AdminSettlementsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [confirmCredit, setConfirmCredit] = useState<Settlement | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Settlement | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);

  const { data: list = [], isLoading } = useQuery<Settlement[]>({
    queryKey: QK.settlements,
    queryFn: () => getSettlements(),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: QK.settlements });

  const onSync = async () => {
    setSyncing(true);
    try {
      await syncSettlements();
      toast.success('台账已同步');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSyncing(false);
    }
  };

  const confirmCreditDone = async () => {
    if (!confirmCredit) return;
    setActing(true);
    try {
      await creditSettlement(confirmCredit.id);
      toast.success('补偿单已确认入账');
      setConfirmCredit(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setActing(false);
    }
  };

  const openReject = (s: Settlement) => {
    setRejectTarget(s);
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
      await rejectSettlement(rejectTarget.id, rejectReason.trim());
      toast.success('补偿单已驳回');
      setRejectTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setActing(false);
    }
  };

  const columns = useMemo<Column<Settlement>[]>(
    () => [
      {
        key: 'orderNo',
        title: '订单号',
        width: '160px',
        render: (s) => {
          const no = s.order?.orderNo ?? s.orderId;
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {no}
              <CopyButton value={no} title="复制订单号" />
            </span>
          );
        },
      },
      {
        key: 'master',
        title: '师傅',
        width: '120px',
        render: (s) =>
          s.master?.realName ?? s.master?.user?.profile?.nickname ?? '-',
      },
      {
        key: 'type',
        title: '类型',
        width: '100px',
        render: (s) =>
          s.type === 'compensation' ? '退款补偿' : '常规结算',
      },
      {
        key: 'orderAmount',
        title: '订单金额',
        width: '110px',
        align: 'right',
        render: (s) => <span style={{ fontWeight: 600 }}>¥{s.orderAmount}</span>,
      },
      {
        key: 'platformFee',
        title: '平台费',
        width: '90px',
        align: 'right',
        render: (s) => `¥${s.platformFee}`,
      },
      {
        key: 'refundAmount',
        title: '用户退款',
        width: '100px',
        align: 'right',
        render: (s) =>
          s.type === 'compensation' ? (
            <span style={{ color: 'var(--color-danger)' }}>¥{s.refundAmount ?? '-'}</span>
          ) : (
            <span className="field-hint">—</span>
          ),
      },
      {
        key: 'masterAmount',
        title: '师傅入账',
        width: '110px',
        align: 'right',
        render: (s) => `¥${s.masterAmount}`,
      },
      {
        key: 'status',
        title: '状态',
        width: '100px',
        render: (s) => {
          const m =
            SETTLEMENT_STATUS[s.status] ?? { label: s.status, tone: 'gray' as const };
          return <StatusBadge tone={m.tone}>{m.label}</StatusBadge>;
        },
      },
      {
        key: 'createdAt',
        title: '生成时间',
        width: '160px',
        render: (s) =>
          formatDateTime(s.createdAt),
        },
      {
        key: 'reviewed',
        title: '审核',
        width: '170px',
        render: (s) =>
          s.status === 'pending' ? (
            <span className="field-hint">待审核</span>
          ) : s.reviewedByUser?.phone ? (
            <span>
              {s.reviewedByUser.phone}
              <br />
              <span className="field-hint">{formatDateTime(s.reviewedAt)}</span>
            </span>
          ) : (
            <span className="field-hint">—</span>
          ),
      },
      {
        key: 'op',
        title: '操作',
        width: '130px',
        render: (s) =>
          s.status === 'pending' ? (
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <button
                type="button"
                className="btn-link"
                onClick={() => setConfirmCredit(s)}
              >
                确认入账
              </button>
              <button
                type="button"
                className="btn-link btn-link-danger"
                onClick={() => openReject(s)}
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

  return (
    <>
      <div className="page-head">
        <h2>结算台账</h2>
        <button
          type="button"
          className="btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={onSync}
          disabled={syncing}
        >
          {syncing ? '同步中…' : '补生成台账'}
        </button>
      </div>

      <p className="field-hint" style={{ marginTop: -4, marginBottom: 12 }}>
        常规结算单在订单验收后自动入账；阶梯退款的补偿单需审核「确认入账」后才会进入师傅余额。
      </p>

      <DataTable
        columns={columns}
        rows={list}
        rowKey={(s) => s.id}
        loading={isLoading}
        emptyText="暂无结算记录"
      />

      <ConfirmDialog
        open={!!confirmCredit}
        title="确认入账"
        message={`确认将订单 ${confirmCredit?.order?.orderNo ?? ''} 的补偿款 ¥${
          confirmCredit ? Number(confirmCredit.masterAmount).toFixed(2) : ''
        } 入账给师傅？入账后进入师傅可提现余额。`}
        confirmLabel="确认入账"
        loading={acting}
        onCancel={() => setConfirmCredit(null)}
        onConfirm={confirmCreditDone}
      />

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="驳回补偿单"
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
