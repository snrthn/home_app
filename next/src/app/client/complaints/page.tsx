'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyOrders, type OrderLite } from '@/lib/orders-api';
import { createComplaint } from '@/lib/tickets-api';
import { PortalNavSetter } from '@/components/PortalShell';

const REASONS: [string, string][] = [
  ['attitude', '服务态度'],
  ['quality', '服务质量'],
  ['fee', '费用争议'],
  ['late', '迟到爽约'],
  ['damage', '物品损坏'],
  ['other', '其他'],
];

const COMPLAINTABLE: string[] = ['reviewed', 'evaluated'];

export default function ClientComplaintsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    orderId: '',
    reason: 'quality',
    title: '',
    content: '',
    expectation: '',
  });
  const [msg, setMsg] = useState('');

  const { data: orders = [] } = useQuery<OrderLite[]>({
    queryKey: ['my-orders-all'],
    queryFn: getMyOrders,
  });

  const completedOrders = useMemo(
    () => orders.filter((o) => COMPLAINTABLE.includes(o.status)),
    [orders],
  );

  const mutation = useMutation({
    mutationFn: createComplaint,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-tickets'] });
      setForm({ orderId: '', reason: 'quality', title: '', content: '', expectation: '' });
      setMsg('投诉已提交，我们将在 SLA 内尽快处理');
    },
    onError: (e: any) => setMsg(e?.response?.data?.message || '提交失败，请稍后重试'),
  });

  const submit = () => {
    setMsg('');
    if (!form.orderId) return setMsg('请选择要投诉的已完成订单');
    if (!form.title.trim()) return setMsg('请填写投诉标题');
    if (!form.content.trim()) return setMsg('请填写投诉内容');
    mutation.mutate({
      orderId: form.orderId,
      reason: form.reason as any,
      title: form.title,
      content: form.content,
      expectation: form.expectation || undefined,
    });
  };

  return (
    <>
      <PortalNavSetter
        title="我的投诉"
        showBack
        backHref="/client/me"
        menu={[{ label: '投诉记录', href: '/client/complaints/history' }]}
      />

      <div className="laoma-container">
        <div className="card-soft">
          <div className="section-title">提交投诉</div>
          <p className="field-hint">仅「已完成 / 已评价」的订单可发起投诉。</p>

          <div className="complaint-form">
            <label className="form-label">关联订单</label>
            <select
              className="select"
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            >
              <option value="">选择已完成订单…</option>
              {completedOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNo}（{o.serviceItem?.name ?? '服务'}）
                </option>
              ))}
            </select>
            {completedOrders.length === 0 && (
              <p className="field-hint">暂无可投诉的已完成订单</p>
            )}

            <label className="form-label">投诉原因</label>
            <select
              className="select"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            >
              {REASONS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            <label className="form-label">投诉标题</label>
            <input
              className="select"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="一句话概括问题"
            />

            <label className="form-label">投诉内容</label>
            <textarea
              className="textarea"
              rows={4}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="请描述具体情况…"
            />

            <label className="form-label">期望的处理方式（选填）</label>
            <input
              className="select"
              value={form.expectation}
              onChange={(e) => setForm({ ...form, expectation: e.target.value })}
              placeholder="如：退款 / 重做 / 赔偿"
            />

            <button className="btn-primary" onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending ? '提交中…' : '提交投诉'}
            </button>
          </div>

          {msg && <div className="form-msg">{msg}</div>}
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link href="/client/complaints/history" className="nav-link">
            查看投诉记录
          </Link>
        </div>
      </div>
    </>
  );
}
