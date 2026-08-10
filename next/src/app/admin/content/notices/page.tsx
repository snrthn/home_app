'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotices,
  createNotice,
  updateNotice,
  publishNotice,
  offlineNotice,
  deleteNotice,
  type Notice,
  type NoticeScope,
  type NoticeStatus,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { formatDateTime } from '@/lib/format';
import { StatusBadge } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import RichTextEditor from '@/components/admin/RichTextEditor';
import SanitizedHtml from '@/components/admin/SanitizedHtml';

const SCOPE_LABEL: Record<NoticeScope, string> = {
  customer: '用户端',
  master: '师傅端',
  admin: '运营端',
};
const STATUS_TONE: Record<NoticeStatus, 'gray' | 'green' | 'orange'> = {
  draft: 'gray',
  published: 'green',
  offline: 'orange',
};
const STATUS_LABEL: Record<NoticeStatus, string> = {
  draft: '草稿',
  published: '已发布',
  offline: '已下线',
};
const SCOPE_ORDER: NoticeScope[] = ['customer', 'master', 'admin'];

function PinIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: active ? 'var(--color-primary)' : '#b6c0c8' }}
    >
      <path d="M12 17v5" />
      <path d="M9 10.76V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6.76l2 3.24H7l2-3.24Z" />
    </svg>
  );
}

interface NoticeDraft {
  scope: NoticeScope;
  title: string;
  summary: string;
  contentHtml: string;
  pinned: boolean;
  startAt: string;
  endAt: string;
}

// 新建 / 编辑公告
function NoticeEditModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: NoticeDraft;
  onClose: () => void;
  onSubmit: (dto: NoticeDraft) => Promise<void>;
}) {
  const toast = useToast();
  const [scope, setScope] = useState<NoticeScope>(initial.scope);
  const [nTitle, setNTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [html, setHtml] = useState(initial.contentHtml);
  const [pinned, setPinned] = useState(initial.pinned);
  const [startAt, setStartAt] = useState(initial.startAt);
  const [endAt, setEndAt] = useState(initial.endAt);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!nTitle.trim()) {
      toast.warning('请填写公告标题');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        scope,
        title: nTitle.trim(),
        summary: summary.trim(),
        contentHtml: html,
        pinned,
        startAt,
        endAt,
      });
      onClose();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>{title}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">投放端</label>
            <select
              className="input"
              value={scope}
              onChange={(e) => setScope(e.target.value as NoticeScope)}
            >
              {SCOPE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">公告标题</label>
            <input
              className="input"
              value={nTitle}
              onChange={(e) => setNTitle(e.target.value)}
              placeholder="如：春节暂停接单通知 / 清洗服务5折活动"
            />
          </div>
          <div className="field">
            <label className="field-label">摘要（列表展示，选填）</label>
            <textarea
              className="input"
              style={{ minHeight: 56 }}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="一句话概述，不填则列表仅显示标题"
            />
          </div>
          <div className="field">
            <label className="field-label">正文（支持富文本、内联图片、文件链接）</label>
            <RichTextEditor value={html} onChange={setHtml} />
          </div>
          <div className="field-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              置顶（优先展示）
            </label>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="field-label">生效开始（选填，留空=立即）</label>
              <input
                type="datetime-local"
                className="input"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="field-label">生效结束（选填，留空=长期）</label>
              <input
                type="datetime-local"
                className="input"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 预览（只读，DOMPurify 已清洗）
function PreviewModal({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>{notice.title}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          {notice.contentHtml ? (
            <SanitizedHtml html={notice.contentHtml} />
          ) : (
            <div className="data-empty">该公告暂无正文内容</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NoticesPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data: notices = [], isLoading: loading } = useQuery<Notice[]>({
    queryKey: QK.adminNotices,
    queryFn: () => getNotices(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Notice | null>(null);
  const [previewItem, setPreviewItem] = useState<Notice | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: 'publish' | 'offline' | 'delete';
    item: Notice;
  } | null>(null);
  const [acting, setActing] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: QK.adminNotices });

  const handleCreate = async (dto: NoticeDraft) => {
    try {
      await createNotice(dto);
      toast.success('公告已创建（草稿）');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      throw e;
    }
  };

  const handleUpdate = async (id: string, dto: NoticeDraft) => {
    try {
      await updateNotice(id, dto);
      toast.success('公告已保存');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      throw e;
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const { kind, item } = confirm;
    setActing(true);
    try {
      if (kind === 'publish') {
        await publishNotice(item.id);
        toast.success('已发布，前端将展示该公告');
      } else if (kind === 'offline') {
        await offlineNotice(item.id);
        toast.success('已下线，前端不再展示');
      } else {
        await deleteNotice(item.id);
        toast.success('已删除');
      }
      setConfirm(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setActing(false);
    }
  };

  const grouped = SCOPE_ORDER.map((scope) => ({
    scope,
    items: notices.filter((n) => n.scope === scope),
  }));

  return (
    <div>
      <div className="page-head">
        <h2>公告通知</h2>
        <button
          type="button"
          className="btn-primary btn-md"
          style={{ marginLeft: 'auto' }}
          onClick={() => setCreateOpen(true)}
        >
          + 新建公告
        </button>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <p className="field-hint" style={{ marginTop: -4, marginBottom: 14 }}>
          运营端编辑发布的广播内容（活动/规则/维护/节假日等）。保存为草稿后可继续编辑，点「发布」即对对应端用户/师傅可见；「下线」后前端不再展示。置顶公告在列表最前展示。
        </p>

        {loading && <div className="data-loading">加载中…</div>}
        {!loading && notices.length === 0 && (
          <div className="data-empty">暂无公告，点击右上角「新建公告」开始维护</div>
        )}

        {grouped.map(({ scope, items }) => (
          <div key={scope} style={{ marginBottom: 22 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-text)',
                margin: '8px 0 10px',
                paddingLeft: 8,
                borderLeft: '3px solid var(--color-primary)',
              }}
            >
              {SCOPE_LABEL[scope]}
            </div>

            {items.length === 0 && (
              <div className="data-empty" style={{ background: '#fafbfc' }}>
                该端暂无公告
              </div>
            )}

            {items.map((n) => (
              <div
                key={n.id}
                style={{
                  border: '1px solid #eef0f2',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {n.pinned && <PinIcon active />}
                    <span style={{ fontWeight: 600 }}>{n.title}</span>
                    <StatusBadge tone={STATUS_TONE[n.status]}>{STATUS_LABEL[n.status]}</StatusBadge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" className="btn-link" onClick={() => setEditItem(n)}>
                      编辑
                    </button>
                    <button type="button" className="btn-link" onClick={() => setPreviewItem(n)}>
                      预览
                    </button>
                    {n.status !== 'published' ? (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setConfirm({ kind: 'publish', item: n })}
                      >
                        发布
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setConfirm({ kind: 'offline', item: n })}
                      >
                        下线
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-link btn-link-danger"
                      onClick={() => setConfirm({ kind: 'delete', item: n })}
                    >
                      删除
                    </button>
                  </div>
                </div>
                {n.summary && (
                  <div style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 6 }}>
                    {n.summary}
                  </div>
                )}
                <div style={{ color: '#9aa7b2', fontSize: 12 }}>
                  {n.status === 'published' && n.publishedAt
                    ? `发布于 ${formatDateTime(n.publishedAt)}`
                    : `创建于 ${formatDateTime(n.createdAt)}`}
                  {(n.startAt || n.endAt) && (
                    <span style={{ marginLeft: 10 }}>
                      生效：{n.startAt ? formatDateTime(n.startAt) : '即起'}
                      {' ~ '}
                      {n.endAt ? formatDateTime(n.endAt) : '长期'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {createOpen && (
        <NoticeEditModal
          title="新建公告"
          initial={{
            scope: 'customer',
            title: '',
            summary: '',
            contentHtml: '',
            pinned: false,
            startAt: '',
            endAt: '',
          }}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {editItem && (
        <NoticeEditModal
          key={editItem.id}
          title={`编辑公告 · ${SCOPE_LABEL[editItem.scope]}`}
          initial={{
            scope: editItem.scope,
            title: editItem.title,
            summary: editItem.summary ?? '',
            contentHtml: editItem.contentHtml,
            pinned: editItem.pinned,
            startAt: editItem.startAt ? editItem.startAt.slice(0, 16) : '',
            endAt: editItem.endAt ? editItem.endAt.slice(0, 16) : '',
          }}
          onClose={() => setEditItem(null)}
          onSubmit={(dto) => handleUpdate(editItem.id, dto)}
        />
      )}

      {previewItem && <PreviewModal notice={previewItem} onClose={() => setPreviewItem(null)} />}

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.kind === 'publish'
            ? '发布该公告'
            : confirm?.kind === 'offline'
              ? '下线该公告'
              : '删除该公告'
        }
        message={
          confirm?.kind === 'publish'
            ? '发布后该公告对对应端用户/师傅立即可见（在生效时间窗内）。'
            : confirm?.kind === 'offline'
              ? '下线后该公告从前端隐藏，可再次发布恢复。'
              : '删除后不可恢复，确定删除该公告？'
        }
        confirmLabel={
          confirm?.kind === 'publish'
            ? '确认发布'
            : confirm?.kind === 'offline'
              ? '确认下线'
              : '确认删除'
        }
        loading={acting}
        onCancel={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
