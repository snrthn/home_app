'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { getToken } from '@/lib/auth';
import DataTable, { type Column, StatusBadge } from '@/components/admin/DataTable';
import TicketDetail from '@/components/admin/TicketDetail';
import TicketProcess from '@/components/admin/TicketProcess';
import TicketAssign from '@/components/admin/TicketAssign';
import { formatDateTime } from '@/lib/format';
import {
  getTickets,
  getTicket,
  type TicketListItem,
  type TicketStatus,
  type ComplaintResult,
  TICKET_STATUS_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_TONE,
  COMPLAINT_RESULT_LABEL,
} from '@/lib/tickets-api';

const STATUS_OPTIONS: TicketStatus[] = [
  'open',
  'processing',
  'pendingUser',
  'resolved',
  'rejected',
  'closed',
];

const REASON_LABEL: Record<string, string> = {
  attitude: '服务态度',
  quality: '服务质量',
  fee: '费用争议',
  late: '迟到爽约',
  damage: '物品损坏',
  other: '其他',
};

export default function AdminComplaintsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [view, setView] = useState<{ id: string; type: 'detail' | 'process' | 'assign' } | null>(null);

  const queryKey = ['admin-complaints', status];
  const { data: list = [], isLoading, refetch } = useQuery<TicketListItem[]>({
    queryKey,
    queryFn: () =>
      getTickets({ type: 'complaint', status: status || undefined }),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const base = process.env.NEXT_PUBLIC_API_BASE
      ? process.env.NEXT_PUBLIC_API_BASE.replace(/\/api$/, '')
      : `http://${window.location.hostname}:3721`;
    const socket = io(base, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      auth: { token: getToken() ?? undefined },
    });
    socket.on('ticket-update', () => {
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
      if (viewRef.current) qc.invalidateQueries({ queryKey: ['admin-ticket', viewRef.current.id] });
    });
    return () => {
      socket.disconnect();
    };
  }, [qc]);

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-ticket', view?.id],
    queryFn: () => getTicket(view!.id),
    enabled: !!view,
  });

  const columns = useMemo<Column<TicketListItem>[]>(
    () => [
      { key: 'ticketNo', title: '工单号', width: '150px' },
      {
        key: 'reason',
        title: '投诉原因',
        width: '100px',
        render: (t) => (t.complaint?.reason ? (REASON_LABEL[t.complaint.reason] ?? t.complaint.reason) : '-'),
      },
      {
        key: 'title',
        title: '标题',
        render: (t) => <span className="cell-ellipsis" title={t.title}>{t.title}</span>,
      },
      {
        key: 'priority',
        title: '优先级',
        width: '90px',
        render: (t) => <StatusBadge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</StatusBadge>,
      },
      {
        key: 'status',
        title: '状态',
        width: '100px',
        render: (t) => <StatusBadge tone={STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</StatusBadge>,
      },
      {
        key: 'order',
        title: '关联订单',
        width: '160px',
        render: (t) => t.order?.orderNo ?? '-',
      },
      {
        key: 'customer',
        title: '投诉人',
        width: '120px',
        render: (t) => t.customer?.phone ?? '-',
      },
      {
        key: 'result',
        title: '处置结果',
        width: '110px',
        render: (t) =>
          t.complaint?.result ? (
            <StatusBadge tone="green">{COMPLAINT_RESULT_LABEL[t.complaint.result as ComplaintResult]}</StatusBadge>
          ) : (
            <span className="field-hint">待处置</span>
          ),
      },
      {
        key: 'createdAt',
        title: '创建时间',
        width: '160px',
        render: (t) => formatDateTime(t.createdAt),
      },
      {
        key: '_actions',
        title: '操作',
        width: '180px',
        render: (t) => (
          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
            <button type="button" className="btn-link" onClick={() => setView({ id: t.id, type: 'detail' })}>详情</button>
            <button type="button" className="btn-link" onClick={() => setView({ id: t.id, type: 'process' })}>处理</button>
            <button type="button" className="btn-link" onClick={() => setView({ id: t.id, type: 'assign' })}>改派</button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <div className="page-head">
        <h2>投诉处理</h2>
        <span className="field-hint">仅已完成订单可发起 · 处置联动退款 / 补偿</span>
      </div>

      <div className="filter-bar">
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | '')}>
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button className="btn-ghost" onClick={() => refetch()}>刷新</button>
      </div>

      <DataTable
        columns={columns}
        rows={list}
        rowKey={(t) => t.id}
        loading={isLoading}
        emptyText="暂无投诉工单"
      />

      {view && detail && view.type === 'detail' && (
        <TicketDetail ticket={detail} onClose={() => setView(null)} />
      )}
      {view && detail && view.type === 'process' && (
        <TicketProcess
          ticket={detail}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ['admin-ticket', view.id] });
            qc.invalidateQueries({ queryKey: ['admin-complaints'] });
          }}
          onClose={() => setView(null)}
        />
      )}
      {view && detail && view.type === 'assign' && (
        <TicketAssign
          ticket={detail}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ['admin-ticket', view.id] });
            qc.invalidateQueries({ queryKey: ['admin-complaints'] });
          }}
          onClose={() => setView(null)}
        />
      )}
      {view && detailLoading && !detail && <div className="form-msg">加载工单详情…</div>}
    </>
  );
}
