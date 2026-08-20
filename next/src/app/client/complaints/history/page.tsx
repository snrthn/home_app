'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getMyTickets, type TicketListItem, TICKET_STATUS_LABEL, PRIORITY_LABEL } from '@/lib/tickets-api';
import { PortalNavSetter } from '@/components/PortalShell';
import { StatusBadge } from '@/components/admin/DataTable';
import { formatDateTime } from '@/lib/format';

export default function ClientComplaintHistoryPage() {
  const { data: tickets = [], isLoading } = useQuery<TicketListItem[]>({
    queryKey: ['my-tickets'],
    queryFn: getMyTickets,
    refetchOnMount: 'always',
  });

  return (
    <>
      <PortalNavSetter
        title="投诉记录"
        showBack
        backHref="/client/complaints"
        menu={[{ label: '去投诉', href: '/client/complaints' }]}
      />

      <div className="laoma-container">
        {isLoading ? (
          <p className="field-hint">加载中…</p>
        ) : tickets.length === 0 ? (
          <div className="card-soft">
            <p className="field-hint">暂无投诉记录</p>
            <Link href="/client/complaints" className="btn-primary" style={{ marginTop: 16, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              去提交投诉
            </Link>
          </div>
        ) : (
          <div className="feedback-list">
            {tickets.map((t) => (
              <div key={t.id} className="feedback-item">
                <div className="feedback-head">
                  <span className="feedback-no">{t.ticketNo}</span>
                  <StatusBadge tone="blue">{TICKET_STATUS_LABEL[t.status]}</StatusBadge>
                </div>
                <div className="feedback-title">{t.title}</div>
                <div className="field-hint">
                  优先级 {PRIORITY_LABEL[t.priority]}
                  {t.complaint?.result ? ` · 处置结果 ${t.complaint.result}` : ''}
                  {` · ${formatDateTime(t.createdAt)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
