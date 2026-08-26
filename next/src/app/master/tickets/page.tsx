'use client';

import { useState } from 'react';
import { PortalNavSetter } from '@/components/PortalShell';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyTickets,
  appealTicket,
  type TicketListItem,
  TICKET_TYPE_LABEL,
  TICKET_STATUS_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_TONE,
} from '@/lib/tickets-api';
import { StatusBadge } from '@/components/admin/DataTable';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { getApiErrorMsg } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import EmptyState from '@/components/EmptyState';

export default function MasterTicketsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [appeal, setAppeal] = useState<{ id: string; content: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: list = [], isLoading } = useQuery<TicketListItem[]>({
    queryKey: ['master-tickets'],
    queryFn: getMyTickets,
    refetchOnMount: 'always',
  });

  const onAppeal = async () => {
    if (!appeal || !appeal.content.trim()) {
      toast.error('请填写申诉内容');
      return;
    }
    setSubmitting(true);
    try {
      await appealTicket(appeal.id, appeal.content.trim());
      toast.success('申诉已提交，客服将尽快处理');
      setAppeal(null);
      qc.invalidateQueries({ queryKey: ['master-tickets'] });
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PortalNavSetter
        title="我的工单"
        showBack
        backHref="/master/me"
        menu={[{ label: '刷新', onClick: () => qc.invalidateQueries({ queryKey: ['master-tickets'] }) }]}
      />
      <div className="laoma-container">
        {isLoading ? (
          <div className="card">
            <p className="field-hint">加载中…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="card">
            <EmptyState text="暂无相关工单" />
          </div>
        ) : (
          list.map((t) => (
            <div key={t.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{t.ticketNo}</span>
                <StatusBadge tone={STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</StatusBadge>
              </div>
              <div style={{ marginTop: 6, color: 'var(--color-text-soft)', fontSize: 13 }}>
                {TICKET_TYPE_LABEL[t.type]} · {t.title}
              </div>
              <div
                style={{
                  marginTop: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--color-text-soft)',
                  fontSize: 12,
                }}
              >
                <span>关联订单 {t.order?.orderNo ?? '-'}</span>
                <StatusBadge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</StatusBadge>
              </div>
              <div style={{ marginTop: 6, color: 'var(--color-muted)', fontSize: 12 }}>
                创建 {formatDateTime(t.createdAt)}
              </div>
              <div style={{ marginTop: 10, textAlign: 'right' }}>
                <button type="button" className="btn-link" onClick={() => setAppeal({ id: t.id, content: '' })}>
                  申诉
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={!!appeal}
        onClose={() => !submitting && setAppeal(null)}
        title="申诉"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setAppeal(null)} disabled={submitting}>
              取消
            </button>
            <button type="button" className="btn-primary" onClick={onAppeal} disabled={submitting}>
              {submitting ? '提交中…' : '提交申诉'}
            </button>
          </>
        }
      >
        <p style={{ marginTop: 0 }} className="field-hint">
          对工单处理有异议？提交申诉，客服将复核。
        </p>
        <textarea
          className="input"
          rows={4}
          maxLength={200}
          placeholder="请描述您的申诉理由…"
          value={appeal?.content ?? ''}
          onChange={(e) => setAppeal((a) => (a ? { ...a, content: e.target.value } : a))}
          disabled={submitting}
          style={{ width: '100%', resize: 'vertical' }}
        />
      </Modal>
    </>
  );
}
