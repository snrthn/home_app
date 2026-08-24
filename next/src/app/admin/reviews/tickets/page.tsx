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
  type TicketType,
  type TicketPriority,
  TICKET_TYPE_LABEL,
  TICKET_STATUS_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_TONE,
} from '@/lib/tickets-api';

const TYPE_OPTIONS: TicketType[] = ['consult', 'complaint', 'refund', 'report', 'system'];
const STATUS_OPTIONS: TicketStatus[] = [
  'open',
  'processing',
  'pendingUser',
  'resolved',
  'rejected',
  'closed',
];
const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

function overdue(deadline?: string | null, closed?: boolean) {
  if (!deadline || closed) return false;
  return new Date(deadline).getTime() < Date.now();
}

// SLA 倒计时：取 firstResponseDeadline / resolveDeadline 中尚未到达的较小者
function fmtRemaining(ms: number): string {
  if (ms <= 0) return '已超时';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `剩 ${d}天${h}小时`;
  if (h > 0) return `剩 ${h}小时${m}分`;
  return `剩 ${m}分`;
}

function slaInfo(t: TicketListItem, now: number) {
  const closed = t.status === 'closed' || t.status === 'resolved';
  if (closed) return { text: '已完结', overdue: false, done: true };
  const fr = t.firstResponseDeadline ? new Date(t.firstResponseDeadline).getTime() : null;
  const rs = t.resolveDeadline ? new Date(t.resolveDeadline).getTime() : null;
  // 无 SLA 截止时间（如咨询类工单）：中性展示，不标红
  if (fr == null && rs == null) return { text: '-', overdue: false, done: false };
  const valid = [fr, rs].filter((x): x is number => x != null && x >= now);
  if (valid.length === 0) return { text: '已超时', overdue: true, done: false };
  return { text: fmtRemaining(Math.min(...valid) - now), overdue: false, done: false };
}

export default function AdminTicketsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [type, setType] = useState<TicketType | ''>('');
  const [priority, setPriority] = useState<TicketPriority | ''>('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [view, setView] = useState<{ id: string; type: 'detail' | 'process' | 'assign' } | null>(null);
  // SLA 实时倒计时：每 30s 刷新一次 now，驱动倒计时列重新计算
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const queryKey = ['admin-tickets', status, type, priority, activeOnly];
  const { data: list = [], isLoading, refetch } = useQuery<TicketListItem[]>({
    queryKey,
    queryFn: () =>
      getTickets({
        status: status || undefined,
        type: type || undefined,
        priority: priority || undefined,
        active: activeOnly || undefined,
      }),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const viewRef = useRef(view);
  viewRef.current = view;

  // 实时刷新：订阅 tickets-pool 房间（后端广播 ticket-update）
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
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
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
        key: 'type',
        title: '类型',
        width: '80px',
        render: (t) => TICKET_TYPE_LABEL[t.type],
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
        title: '提交人',
        width: '120px',
        render: (t) => t.customer?.phone ?? '-',
      },
      {
        key: 'assignee',
        title: '受理人',
        width: '120px',
        render: (t) => t.assignee?.phone ?? <span className="field-hint">未分配</span>,
      },
      {
        key: 'deadline',
        title: '处理截止',
        width: '170px',
        render: (t) =>
          t.resolveDeadline ? (
            <span className={overdue(t.resolveDeadline, t.status === 'closed' || t.status === 'resolved') ? 'text-overdue' : ''}>
              {formatDateTime(t.resolveDeadline)}
            </span>
          ) : (
            '-'
          ),
      },
      {
        key: 'sla',
        title: 'SLA 倒计时',
        width: '130px',
        render: (t) => {
          const info = slaInfo(t, now);
          if (info.done) return <span className="field-hint">已完结</span>;
          return <span className={info.overdue ? 'text-overdue' : ''}>{info.text}</span>;
        },
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
    [now],
  );

  return (
    <>
      <div className="page-head">
        <h2>工单管理</h2>
        <span className="field-hint">工单池 · 实时刷新（SLA 超时自动升级）</span>
      </div>

      <div className="filter-bar">
        <select className="select" value={type} onChange={(e) => setType(e.target.value as TicketType | '')}>
          <option value="">全部类型</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{TICKET_TYPE_LABEL[t]}</option>
          ))}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | '')}>
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority | '')}>
          <option value="">全部优先级</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
        <label className="checkbox-line">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          仅活跃工单
        </label>
        <button className="btn-ghost" onClick={() => refetch()}>刷新</button>
      </div>

      <DataTable
        columns={columns}
        rows={list}
        rowKey={(t) => t.id}
        loading={isLoading}
        emptyText="暂无工单"
      />

      {view && detail && view.type === 'detail' && (
        <TicketDetail ticket={detail} onClose={() => setView(null)} />
      )}
      {view && detail && view.type === 'process' && (
        <TicketProcess
          ticket={detail}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ['admin-ticket', view.id] });
            qc.invalidateQueries({ queryKey: ['admin-tickets'] });
          }}
          onClose={() => setView(null)}
        />
      )}
      {view && detail && view.type === 'assign' && (
        <TicketAssign
          ticket={detail}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ['admin-ticket', view.id] });
            qc.invalidateQueries({ queryKey: ['admin-tickets'] });
          }}
          onClose={() => setView(null)}
        />
      )}
      {view && detailLoading && !detail && <div className="form-msg">加载工单详情…</div>}
    </>
  );
}
