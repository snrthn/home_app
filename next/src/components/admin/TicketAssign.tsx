'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import { Field } from '@/components/form/Field';
import { getAdmins, type AdminUser } from '@/lib/admin-api';
import { assignTicket, type TicketDetail as TD } from '@/lib/tickets-api';

// 独立的「改派」弹窗：只负责改派受理人，与详情、处理解耦。
export default function TicketAssign({
  ticket,
  onChanged,
  onClose,
}: {
  ticket: TD;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getAdmins()
      .then(setAdmins)
      .catch(() => setAdmins([]));
  }, []);

  const submit = async () => {
    if (!assigneeId) return;
    setBusy(true);
    setMsg('');
    try {
      await assignTicket(ticket.id, assigneeId);
      setMsg('已改派');
      onChanged();
      onClose();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.message || '改派失败');
      setBusy(false);
    }
  };

  // FooterBar：取消 + 确认改派，与表单的「改派给」下拉控件分离，不挤在一行。
  const footer = (
    <>
      <button className="btn-secondary" disabled={busy} onClick={onClose}>取消</button>
      <button className="btn-primary" disabled={busy || !assigneeId} onClick={submit}>
        确认改派
      </button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={`${ticket.ticketNo} · 改派`} width="md" footer={footer}>
      <div className="field-hint" style={{ marginBottom: 16 }}>当前受理人：{ticket.assignee?.phone ?? '未分配'}</div>
      <Field label="改派给">
        <select className="select" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">选择后台账号…</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.profile?.nickname || a.phone}
              {a.staffRole ? `（${a.staffRole.name}）` : ''}
            </option>
          ))}
        </select>
      </Field>
      {msg && <div className="form-msg">{msg}</div>}
    </Modal>
  );
}
