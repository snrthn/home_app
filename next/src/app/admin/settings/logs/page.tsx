'use client';

import { useState } from 'react';
import { useEscClose } from '@/lib/useEscClose';
import { useQuery } from '@tanstack/react-query';
import {
  getOperationLogs,
  type OperationLog,
  type OperationLogQuery,
} from '@/lib/admin-api';
import DataTable, { type Column } from '@/components/admin/DataTable';

const MODULES = [
  { value: '', label: '全部模块' },
  { value: 'users', label: '用户/账号' },
  { value: 'masters', label: '师傅' },
  { value: 'services', label: '服务类目' },
  { value: 'orders', label: '订单' },
  { value: 'content', label: '内容' },
  { value: 'rbac', label: '角色权限' },
];

const PAGE_SIZE = 15;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-soft)' }}>{label}</span>
      <span style={{ fontSize: 14, wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

export default function OperationLogsPage() {
  const [module, setModule] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OperationLog | null>(null);
  // Esc 关闭详情弹窗
  useEscClose(() => setSelected(null));

  const params: OperationLogQuery = {
    module: module || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to + 'T23:59:59').toISOString() : undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['operation-logs', module, from, to, page],
    queryFn: () => getOperationLogs(params),
  });

  const list: OperationLog[] = data?.list ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<OperationLog>[] = [
    {
      key: 'username',
      title: '操作人',
      render: (r) => r.username || r.userId || '—',
    },
    {
      key: 'staffRoleKey',
      title: '角色',
      render: (r) => r.staffRoleKey || '—',
    },
    { key: 'module', title: '模块', render: (r) => r.module },
    {
      key: 'action',
      title: '动作',
      render: (r) => <code>{r.action}</code>,
    },
    {
      key: 'resourceId',
      title: '资源',
      render: (r) => r.resourceId || '—',
    },
    { key: 'ip', title: 'IP', render: (r) => r.ip || '—' },
    {
      key: 'createdAt',
      title: '时间',
      render: (r) => new Date(r.createdAt).toLocaleString('zh-CN'),
    },
    {
      key: 'actions',
      title: '查看',
      align: 'center',
      width: '80px',
      render: (r) => (
        <button
          type="button"
          className="btn-link"
          onClick={() => setSelected(r)}
        >
          查看
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <h2>操作日志</h2>
      </div>
      <div className="card">
        <div
          className="toolbar"
          style={{
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'flex-end',
            marginBottom: 12,
          }}
        >
          <label
            style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}
          >
            模块
            <select
              className="input"
              value={module}
              onChange={(e) => {
                setModule(e.target.value);
                setPage(1);
              }}
            >
              {MODULES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label
            style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}
          >
            起始
            <input
              className="input"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label
            style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}
          >
            截止
            <input
              className="input"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <span style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
            共 {total} 条
          </span>
        </div>

        <DataTable
          columns={columns}
          rows={list}
          rowKey={(r) => r.id}
          loading={isLoading}
        />

        {totalPages > 1 && (
          <div
            className="toolbar"
            style={{ marginTop: 12, justifyContent: 'flex-end' }}
          >
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span style={{ fontSize: 13 }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="modal-header">
              <h3>操作详情</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelected(null)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <Field label="操作人" value={selected.username || selected.userId || '—'} />
                <Field label="角色" value={selected.staffRoleKey || '—'} />
                <Field label="模块" value={selected.module} />
                <Field label="动作" value={<code>{selected.action}</code>} />
                <Field label="资源" value={selected.resourceId || '—'} />
                <Field label="IP" value={selected.ip || '—'} />
                <Field
                  label="时间"
                  value={new Date(selected.createdAt).toLocaleString('zh-CN')}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-soft)' }}>详情</span>
                {selected.detail ? (
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      background: 'var(--color-bg-soft, #f5f5f5)',
                      borderRadius: 8,
                      fontSize: 12,
                      maxHeight: 280,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {JSON.stringify(selected.detail, null, 2)}
                  </pre>
                ) : (
                  <span style={{ fontSize: 14, color: 'var(--color-text-soft)' }}>无</span>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelected(null)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
