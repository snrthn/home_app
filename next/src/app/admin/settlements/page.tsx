'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettlements, syncSettlements, markSettlementDone, type Settlement } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import DataTable, { type Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/DataTable';

const SETTLEMENT_STATUS: Record<string, { label: string; tone: 'green' | 'orange' | 'gray' | 'blue' }> = {
  offline_pending: { label: '待打款', tone: 'orange' },
  offline_done: { label: '已打款', tone: 'green' },
};

export default function AdminSettlementsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

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

  const onDone = async (s: Settlement) => {
    if (!window.confirm(`确认已将订单 ${s.order?.orderNo ?? s.orderId} 的托管金打款给师傅？`)) return;
    try {
      await markSettlementDone(s.id);
      toast.success('已标记为已打款');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };

  const columns = useMemo<Column<Settlement>[]>(
    () => [
      {
        key: 'orderNo',
        title: '订单号',
        width: '160px',
        render: (s) => s.order?.orderNo ?? s.orderId,
      },
      {
        key: 'master',
        title: '师傅',
        width: '120px',
        render: (s) => s.master?.realName ?? s.master?.user?.profile?.nickname ?? '-',
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
        width: '100px',
        align: 'right',
        render: (s) => `¥${s.platformFee}`,
      },
      {
        key: 'masterAmount',
        title: '师傅实收',
        width: '110px',
        align: 'right',
        render: (s) => `¥${s.masterAmount}`,
      },
      {
        key: 'status',
        title: '状态',
        width: '100px',
        render: (s) => {
          const m = SETTLEMENT_STATUS[s.status] ?? { label: s.status, tone: 'gray' as const };
          return <StatusBadge tone={m.tone}>{m.label}</StatusBadge>;
        },
      },
      {
        key: 'createdAt',
        title: '创建时间',
        width: '160px',
        render: (s) => (s.createdAt ? s.createdAt.slice(0, 19).replace('T', ' ') : '-'),
      },
      {
        key: 'op',
        title: '操作',
        width: '120px',
        render: (s) =>
          s.status === 'offline_pending' ? (
            <button type="button" className="btn-link" onClick={() => onDone(s)}>
              标记已打款
            </button>
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
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>结算台账</h2>
        <button type="button" className="btn-primary" style={{ marginLeft: 'auto' }} onClick={onSync} disabled={syncing}>
          {syncing ? '同步中…' : '同步台账'}
        </button>
      </div>

      <p className="field-hint" style={{ marginTop: -4, marginBottom: 12 }}>
        订单完成验收后，平台托管金释放并生成待打款台账；打款给师傅后点「标记已打款」。
      </p>

      <DataTable columns={columns} rows={list} rowKey={(s) => s.id} loading={isLoading} emptyText="暂无结算记录" />
    </>
  );
}
