'use client';

import { useState } from 'react';
import { useEscClose } from '@/lib/useEscClose';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAgreements,
  createAgreementTemplate,
  updateAgreementTemplate,
  createAgreementVersion,
  updateAgreementVersion,
  publishAgreementVersion,
  offlineAgreementVersion,
  type AgreementTemplate,
  type AgreementVersion,
  type AgreementScope,
  type AgreementType,
  type AgreementStatus,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { formatDateTime } from '@/lib/format';
import { StatusBadge } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import RichTextEditor from '@/components/admin/RichTextEditor';
import SanitizedHtml from '@/components/admin/SanitizedHtml';

const SCOPE_LABEL: Record<AgreementScope, string> = {
  customer: '用户端',
  master: '师傅端',
  admin: '运营端',
};
const TYPE_LABEL: Record<AgreementType, string> = {
  registration: '注册协议',
  privacy: '隐私政策',
};
const STATUS_TONE: Record<AgreementStatus, 'gray' | 'green' | 'orange'> = {
  draft: 'gray',
  published: 'green',
  offline: 'orange',
};
const SCOPE_ORDER: AgreementScope[] = ['customer', 'master', 'admin'];

interface VersionDraft {
  title: string;
  contentHtml?: string;
}

// 新建协议类型
function CreateTemplateModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (dto: { scope: AgreementScope; type: AgreementType; title: string }) => Promise<void>;
}) {
  const toast = useToast();
  const [scope, setScope] = useState<AgreementScope>('customer');
  const [type, setType] = useState<AgreementType>('registration');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      toast.warning('请填写协议名称');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ scope, type, title: title.trim() });
      onClose();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>新建协议类型</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">所属端</label>
            <select
              className="input"
              value={scope}
              onChange={(e) => setScope(e.target.value as AgreementScope)}
            >
              {SCOPE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">协议类型</label>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as AgreementType)}
            >
              <option value="registration">{TYPE_LABEL.registration}</option>
              <option value="privacy">{TYPE_LABEL.privacy}</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">协议名称</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：用户注册协议 / 隐私政策"
            />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? '创建中…' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 修改协议类型名称
function EditTemplateModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: string;
  onClose: () => void;
  onSubmit: (dto: { title: string }) => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(initial || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.warning('请填写协议名称');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ title: name.trim() });
      onClose();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>修改协议名称</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">协议名称</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：用户注册协议 / 隐私政策"
            />
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

// 新建 / 编辑版本（编辑仅限草稿）
function VersionEditModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: VersionDraft;
  onClose: () => void;
  onSubmit: (dto: VersionDraft) => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(initial.title || '');
  const [html, setHtml] = useState(initial.contentHtml || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.warning('请填写版本标题');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ title: name.trim(), contentHtml: html });
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
            <label className="field-label">版本标题</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：2026 版 / 修订版"
            />
          </div>
          <div className="field">
            <label className="field-label">协议正文（支持富文本、内联图片、文件链接）</label>
            <RichTextEditor value={html} onChange={setHtml} />
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
function PreviewModal({ ver, onClose }: { ver: AgreementVersion; onClose: () => void }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>
            {ver.title}（v{ver.version}）
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          {ver.contentHtml ? (
            <SanitizedHtml html={ver.contentHtml} />
          ) : (
            <div className="data-empty">该版本暂无正文内容</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgreementsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data: templates = [], isLoading: loading } = useQuery<AgreementTemplate[]>({
    queryKey: QK.adminAgreements,
    queryFn: getAgreements,
  });

  const [createTplOpen, setCreateTplOpen] = useState(false);
  // Esc 关闭所有弹窗
  useEscClose(() => {
    setCreateTplOpen(false);
    setAddVersionTpl(null);
    setEditVer(null);
    setReviseVer(null);
    setEditTpl(null);
    setPreviewVer(null);
  });
  const [addVersionTpl, setAddVersionTpl] = useState<AgreementTemplate | null>(null);
  const [editVer, setEditVer] = useState<{ tpl: AgreementTemplate; ver: AgreementVersion } | null>(null);
  const [previewVer, setPreviewVer] = useState<AgreementVersion | null>(null);
  const [editTpl, setEditTpl] = useState<AgreementTemplate | null>(null);
  const [reviseVer, setReviseVer] = useState<{ tpl: AgreementTemplate; ver: AgreementVersion } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'publish' | 'offline'; tpl: AgreementTemplate; ver: AgreementVersion } | null>(null);
  const [acting, setActing] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: QK.adminAgreements });

  const handleCreateTpl = async (dto: { scope: AgreementScope; type: AgreementType; title: string }) => {
    try {
      await createAgreementTemplate(dto);
      toast.success('协议类型已创建');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      throw e;
    }
  };

  const handleUpdateTpl = async (id: string, dto: { title: string }) => {
    try {
      await updateAgreementTemplate(id, dto);
      toast.success('协议名称已更新');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      throw e;
    }
  };

  const handleAddVersion = async (tpl: AgreementTemplate, dto: VersionDraft) => {
    try {
      await createAgreementVersion(tpl.id, dto);
      toast.success('新版本已创建（草稿）');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      throw e;
    }
  };

  const handleEditVersion = async (tpl: AgreementTemplate, ver: AgreementVersion, dto: VersionDraft) => {
    try {
      await updateAgreementVersion(tpl.id, ver.id, dto);
      toast.success('版本已保存');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      throw e;
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const { kind, tpl, ver } = confirm;
    setActing(true);
    try {
      if (kind === 'publish') {
        await publishAgreementVersion(tpl.id, ver.id);
        toast.success('已上架，成为当前生效版本');
      } else {
        await offlineAgreementVersion(tpl.id, ver.id);
        toast.success('已下架');
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
    items: templates.filter((t) => t.scope === scope),
  }));

  return (
    <div>
      <div className="page-head">
        <h2>协议条款</h2>
        <button
          type="button"
          className="btn-primary btn-md"
          style={{ marginLeft: 'auto' }}
          onClick={() => setCreateTplOpen(true)}
        >
          + 新建协议类型
        </button>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <p className="field-hint" style={{ marginTop: -4, marginBottom: 14 }}>
          同一端同一类型可多次创建版本，版本号只增不减；草稿可就地编辑，已上架版本点「编辑」会基于当前内容生成新草稿，修改后「上架」即替换生效。点「查看前台」会在当前页面打开对外公开展示页（如 /agreements/admin-registration）预览用户/平台端视角。
        </p>

        {loading && <div className="data-loading">加载中…</div>}
        {!loading && templates.length === 0 && (
          <div className="data-empty">暂无协议，点击右上角「新建协议类型」开始维护</div>
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
                该端暂无协议类型
              </div>
            )}

            {items.map((tpl) => (
              <div
                key={tpl.id}
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
                    marginBottom: 10,
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600 }}>{tpl.title}</span>
                    <button
                      type="button"
                      className="agreement-rename-icon"
                      title="修改协议类型名称"
                      aria-label="修改协议类型名称"
                      onClick={() => setEditTpl(tpl)}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                    <StatusBadge tone="blue">{TYPE_LABEL[tpl.type]}</StatusBadge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link
                      href={`/agreements/${tpl.code}`}
                      className="btn-link btn-sm"
                      title="查看前台展示效果（在当前页面打开）"
                    >
                      查看前台
                    </Link>
                    <button
                      type="button"
                      className="btn-link btn-sm"
                      onClick={() => setAddVersionTpl(tpl)}
                    >
                      + 新建版本
                    </button>
                  </div>
                </div>

                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>版本</th>
                        <th>标题</th>
                        <th style={{ width: 90 }}>状态</th>
                        <th style={{ width: 90 }}>当前生效</th>
                        <th style={{ width: 150 }}>更新时间</th>
                        <th style={{ width: 200 }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tpl.versions.map((v) => (
                        <tr key={v.id}>
                          <td>v{v.version}</td>
                          <td>{v.title}</td>
                          <td>
                            <StatusBadge tone={STATUS_TONE[v.status]}>
                              {v.status === 'draft' ? '草稿' : v.status === 'published' ? '已上架' : '已下架'}
                            </StatusBadge>
                          </td>
                          <td>
                            {v.status === 'published' && v.isCurrent ? (
                              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>● 生效中</span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>{formatDateTime(v.updatedAt)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() =>
                                  v.status === 'draft'
                                    ? setEditVer({ tpl, ver: v })
                                    : setReviseVer({ tpl, ver: v })
                                }
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() => setPreviewVer(v)}
                              >
                                预览
                              </button>
                              {v.status !== 'published' && (
                                <button
                                  type="button"
                                  className="btn-link"
                                  onClick={() => setConfirm({ kind: 'publish', tpl, ver: v })}
                                >
                                  上架
                                </button>
                              )}
                              {v.status === 'published' && (
                                <button
                                  type="button"
                                  className="btn-link btn-link-danger"
                                  onClick={() => setConfirm({ kind: 'offline', tpl, ver: v })}
                                >
                                  下架
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {tpl.versions.length === 0 && (
                        <tr>
                          <td colSpan={6}>
                            <div className="data-empty">暂无版本，点击「新建版本」</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {createTplOpen && (
        <CreateTemplateModal onClose={() => setCreateTplOpen(false)} onSubmit={handleCreateTpl} />
      )}

      {addVersionTpl && (
        <VersionEditModal
          key={'new-' + addVersionTpl.id}
          title={`新建版本 · ${TYPE_LABEL[addVersionTpl.type]}`}
          initial={{ title: '', contentHtml: '' }}
          onClose={() => setAddVersionTpl(null)}
          onSubmit={(dto) => handleAddVersion(addVersionTpl, dto)}
        />
      )}

      {editVer && (
        <VersionEditModal
          key={editVer.ver.id}
          title={`编辑版本 · ${TYPE_LABEL[editVer.tpl.type]}`}
          initial={{ title: editVer.ver.title, contentHtml: editVer.ver.contentHtml ?? undefined }}
          onClose={() => setEditVer(null)}
          onSubmit={(dto) => handleEditVersion(editVer.tpl, editVer.ver, dto)}
        />
      )}

      {reviseVer && (
        <VersionEditModal
          key={'rev-' + reviseVer.ver.id}
          title={`修订版本 · 基于 v${reviseVer.ver.version}（将生成新草稿）`}
          initial={{ title: reviseVer.ver.title, contentHtml: reviseVer.ver.contentHtml ?? undefined }}
          onClose={() => setReviseVer(null)}
          onSubmit={(dto) => handleAddVersion(reviseVer.tpl, dto)}
        />
      )}

      {editTpl && (
        <EditTemplateModal
          initial={editTpl.title}
          onClose={() => setEditTpl(null)}
          onSubmit={(dto) => handleUpdateTpl(editTpl.id, dto)}
        />
      )}

      {previewVer && <PreviewModal ver={previewVer} onClose={() => setPreviewVer(null)} />}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === 'publish' ? '上架该版本' : '下架该版本'}
        message={
          confirm?.kind === 'publish'
            ? '上架后该版本将成为当前生效版本，并替换原有的生效版本。'
            : '下架后该版本失效；若没有其他生效版本，公开页将隐藏入口。'
        }
        confirmLabel={confirm?.kind === 'publish' ? '确认上架' : '确认下架'}
        loading={acting}
        onCancel={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
