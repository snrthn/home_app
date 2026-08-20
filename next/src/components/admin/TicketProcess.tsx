'use client';

import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { Field } from '@/components/form/Field';
import {
  type TicketDetail as TD,
  type TicketStatus,
  type ComplaintResult,
  addTicketComment,
  setTicketStatus,
  resolveComplaint,
  TICKET_STATUS_LABEL,
  COMPLAINT_RESULT_LABEL,
} from '@/lib/tickets-api';

// 独立的「处理」弹窗：只负责结案动作（完成处置 / 完成），与详情、改派解耦。
// 确认按钮统一收口到 Modal 的 FooterBar（modal-actions），不与表单下拉控件挤在同一行。
export default function TicketProcess({
  ticket,
  onChanged,
  onClose,
}: {
  ticket: TD;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolveResult, setResolveResult] = useState<ComplaintResult>('refund');
  const [nextStatus, setNextStatus] = useState<TicketStatus>('resolved');
  const [msg, setMsg] = useState('');

  const closed = ticket.status === 'resolved' || ticket.status === 'closed';

  const finish = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg('');
    try {
      if (comment.trim()) await addTicketComment(ticket.id, { content: comment, isInternal: false });
      await fn();
      setMsg(ok);
      onChanged();
      onClose();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.message || '操作失败');
      setBusy(false);
    }
  };

  // FooterBar：已闭环仅给「关闭」；否则给「取消 + 主操作」。
  const footer = closed ? (
    <button className="btn-secondary" onClick={onClose}>关闭</button>
  ) : ticket.type === 'complaint' ? (
    <>
      <button className="btn-secondary" disabled={busy} onClick={onClose}>取消</button>
      <button
        className="btn-danger"
        disabled={busy}
        onClick={() => finish(() => resolveComplaint(ticket.id, { result: resolveResult }), '投诉已处置')}
      >
        完成处置
      </button>
    </>
  ) : (
    <>
      <button className="btn-secondary" disabled={busy} onClick={onClose}>取消</button>
      <button
        className="btn-primary"
        disabled={busy}
        onClick={() => finish(() => setTicketStatus(ticket.id, nextStatus), '状态已更新')}
      >
        完成
      </button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={`${ticket.ticketNo} · 处理`} width="md" footer={footer}>
      {closed ? (
        <div className="field-hint">本工单已{ticket.status === 'closed' ? '关闭' : '处置完成'}，无需再次处理。</div>
      ) : (
        <>
          <Field label="处理备注（选填，将作为对外回复）">
            <textarea
              className="textarea"
              rows={3}
              placeholder="处理备注…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>

          {ticket.type === 'complaint' ? (
            <Field label="处置结果（联动退款 / 补偿）">
              <select
                className="select"
                value={resolveResult}
                onChange={(e) => setResolveResult(e.target.value as ComplaintResult)}
              >
                {(['refund', 'compensate', 'redispatch', 'no_fault'] as ComplaintResult[]).map((r) => (
                  <option key={r} value={r}>{COMPLAINT_RESULT_LABEL[r]}</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="流转到">
              <select
                className="select"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as TicketStatus)}
              >
                <option value="resolved">已解决</option>
                <option value="closed">关闭</option>
              </select>
            </Field>
          )}

          {msg && <div className="form-msg">{msg}</div>}
        </>
      )}
    </Modal>
  );
}
