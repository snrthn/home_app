'use client';

import { StatusBadge } from './DataTable';
import { Modal } from '@/components/Modal';
import { formatDateTime } from '@/lib/format';
import {
  type TicketDetail as TD,
  TICKET_TYPE_LABEL,
  TICKET_STATUS_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_TONE,
  COMPLAINT_RESULT_LABEL,
} from '@/lib/tickets-api';
import { REFUND_STATUS_LABEL, REFUND_STATUS_TONE } from '@/lib/refunds-api';

const COMPLAINT_REASONS: Record<string, string> = {
  attitude: '服务态度',
  quality: '服务质量',
  fee: '费用争议',
  late: '迟到爽约',
  damage: '物品损坏',
  other: '其他',
};

function isOverdue(deadline?: string | null, closed?: boolean) {
  if (!deadline || closed) return false;
  return new Date(deadline).getTime() < Date.now();
}

// 只读「详情」弹窗：展示工单信息、内容、处理时间线。
// 处理 / 改派等写操作由独立的 TicketProcess / TicketAssign 弹窗承接，做到解耦。
export default function TicketDetail({ ticket, onClose }: { ticket: TD; onClose: () => void }) {
  const overdueResolve = isOverdue(
    ticket.resolveDeadline,
    ticket.status === 'closed' || ticket.status === 'resolved',
  );
  const overdueFirst = isOverdue(ticket.firstResponseDeadline, ticket.status !== 'open');

  return (
    <Modal
      open
      onClose={onClose}
      title={`${ticket.ticketNo} · ${TICKET_TYPE_LABEL[ticket.type]}`}
      width="lg"
    >
      <div className="ticket-drawer-head">
        <StatusBadge tone={STATUS_TONE[ticket.status]}>{TICKET_STATUS_LABEL[ticket.status]}</StatusBadge>
        <StatusBadge tone={PRIORITY_TONE[ticket.priority]}>{PRIORITY_LABEL[ticket.priority]}</StatusBadge>
        {ticket.escalationLevel > 0 && (
          <span className="badge-escalated">已升级×{ticket.escalationLevel}</span>
        )}
      </div>

      <div className="ticket-meta">
        <div><span>标题</span><b>{ticket.title}</b></div>
        <div><span>提交人</span><b>{ticket.customer?.phone ?? '-'}</b></div>
        <div><span>关联师傅</span><b>{ticket.master?.realName ?? '-'}</b></div>
        <div>
          <span>关联订单</span>
          <b>{ticket.order ? `${ticket.order.orderNo ?? ticket.orderId}（${ticket.order.status ?? '-'}）` : '-'}</b>
        </div>
        <div><span>受理人</span><b>{ticket.assignee?.phone ?? '未分配'}</b></div>
        <div>
          <span>首响截止</span>
          <b className={overdueFirst ? 'text-overdue' : ''}>
            {ticket.firstResponseDeadline ? formatDateTime(ticket.firstResponseDeadline) : '-'}
            {overdueFirst && ' ⚠超'}
          </b>
        </div>
        <div>
          <span>处理截止</span>
          <b className={overdueResolve ? 'text-overdue' : ''}>
            {ticket.resolveDeadline ? formatDateTime(ticket.resolveDeadline) : '-'}
            {overdueResolve && ' ⚠超'}
          </b>
        </div>
        <div><span>创建时间</span><b>{formatDateTime(ticket.createdAt)}</b></div>
      </div>

      {ticket.type === 'complaint' && (
        <div className="ticket-complaint">
          <div><span>投诉原因</span><b>{ticket.complaint?.reason ? COMPLAINT_REASONS[ticket.complaint.reason] ?? ticket.complaint.reason : '-'}</b></div>
          <div><span>处置结果</span><b>{ticket.complaint?.result ? COMPLAINT_RESULT_LABEL[ticket.complaint.result] : '未处置'}</b></div>
        </div>
      )}

      {ticket.refunds && ticket.refunds.length > 0 && (
        <div className="ticket-complaint">
          {ticket.refunds.map((rf) => (
            <div key={rf.id}>
              <span>退款单</span>
              <b>
                {rf.refundNo}
                {' · '}
                <StatusBadge tone={REFUND_STATUS_TONE[rf.status]}>
                  {REFUND_STATUS_LABEL[rf.status]}
                </StatusBadge>
                {rf.status === 'rejected' && rf.reviewNote ? `（${rf.reviewNote}）` : ''}
              </b>
            </div>
          ))}
        </div>
      )}

      <div className="ticket-content-box">
        <div className="field-hint">内容</div>
        <p className="ticket-content">{ticket.content}</p>
      </div>

      <div className="ticket-section-title">处理时间线</div>
      <div className="ticket-timeline">
        {ticket.comments.length === 0 && <div className="field-hint">暂无留言</div>}
        {ticket.comments.map((c) => (
          <div key={c.id} className={`timeline-item ${c.isInternal ? 'is-internal' : ''}`}>
            <div className="timeline-meta">
              <span>{c.operator?.phone ?? '系统'}</span>
              {c.isInternal && <span className="tag-internal">内部</span>}
              <span className="field-hint">{formatDateTime(c.createdAt)}</span>
            </div>
            <div className="timeline-content">{c.content}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
