'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import DataTable, { type Column, StatusBadge } from '@/components/admin/DataTable';
import {
  getTickets,
  TICKET_TYPE_LABEL,
  TICKET_STATUS_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_TONE,
  type TicketListItem,
} from '@/lib/tickets-api';
import { getRefunds, REFUND_STATUS_LABEL, REFUND_STATUS_TONE, type RefundItem } from '@/lib/refunds-api';
import { formatDateTime } from '@/lib/format';

const ACTIVE = ['open', 'processing', 'pendingUser'];

export default function AdminAftersalePage() {
  const { data: tickets = [], isLoading: lt } = useQuery<TicketListItem[]>({
    queryKey: ['aftersale-tickets'],
    queryFn: () => getTickets({ active: true }),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const { data: refunds = [], isLoading: lr } = useQuery<RefundItem[]>({
    queryKey: ['aftersale-refunds'],
    queryFn: () => getRefunds({ status: 'pending_review' }),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const stats = useMemo(() => {
    const pendingRefunds = refunds.filter((r) => r.status === 'pending_review').length;
    const activeTickets = tickets.filter((t) => ACTIVE.includes(t.status)).length;
    const pendingTickets = tickets.filter((t) => t.status === 'open').length;
    return { pendingRefunds, activeTickets, pendingTickets };
  }, [refunds, tickets]);

  const ticketCols: Column<TicketListItem>[] = [
    { key: 'ticketNo', title: '工单号', width: '150px' },
    { key: 'type', title: '类型', width: '80px', render: (t) => TICKET_TYPE_LABEL[t.type] },
    {
      key: 'title',
      title: '标题',
      render: (t) => (
        <span className="cell-ellipsis" title={t.title}>
          {t.title}
        </span>
      ),
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
    { key: 'order', title: '关联订单', width: '160px', render: (t) => t.order?.orderNo ?? '-' },
    { key: 'createdAt', title: '创建时间', width: '160px', render: (t) => formatDateTime(t.createdAt) },
  ];

  const refundCols: Column<RefundItem>[] = [
    { key: 'refundNo', title: '退款单号', width: '150px' },
    { key: 'order', title: '关联订单', width: '150px', render: (r) => r.order?.orderNo ?? '-' },
    {
      key: 'amount',
      title: '申请金额',
      width: '110px',
      align: 'right',
      render: (r) => <span style={{ fontWeight: 600 }}>¥{Number(r.amount).toFixed(2)}</span>,
    },
    {
      key: 'status',
      title: '状态',
      width: '100px',
      render: (r) => <StatusBadge tone={REFUND_STATUS_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status]}</StatusBadge>,
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
    { key: 'createdAt', title: '申请时间', width: '160px', render: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <>
      <div className="page-head">
        <h2>售后工作台</h2>
        <span className="field-hint">退款 / 工单 聚合视图</span>
      </div>

      <div className="stat-grid">
        <div className="card stat-card">
          <div className="stat-label">待审核退款</div>
          <div className="stat-value">{stats.pendingRefunds}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">进行中工单</div>
          <div className="stat-value">{stats.activeTickets}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">待处理工单</div>
          <div className="stat-value">{stats.pendingTickets}</div>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 28, marginBottom: 12 }}>待审核退款</h2>
      <DataTable columns={refundCols} rows={refunds} rowKey={(r) => r.id} loading={lr} emptyText="暂无待审核退款" />

      <h2 style={{ fontSize: 16, marginTop: 28, marginBottom: 12 }}>进行中工单</h2>
      <DataTable columns={ticketCols} rows={tickets} rowKey={(t) => t.id} loading={lt} emptyText="暂无进行中工单" />
    </>
  );
}
