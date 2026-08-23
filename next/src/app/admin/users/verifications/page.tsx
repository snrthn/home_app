'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPendingMasters,
  approveMaster,
  getCategoryTree,
  type MasterUser,
  type ServiceCategoryNode,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import DataTable, { StatusBadge, type Column } from '@/components/admin/DataTable';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { useEscClose } from '@/lib/useEscClose';
import { Textarea } from '@/components/form/Textarea';

// 把类目树拍平，得到 id->name 以及后代集合（与师傅列表页同逻辑）
function buildTreeMaps(nodes: ServiceCategoryNode[]) {
  const nameMap = new Map<string, string>();
  const childrenMap = new Map<string, string[]>();
  function walk(ns: ServiceCategoryNode[]) {
    ns.forEach((n) => {
      nameMap.set(n.id, n.name);
      if (n.children?.length) {
        childrenMap.set(
          n.id,
          n.children.map((c) => c.id),
        );
        walk(n.children);
      }
    });
  }
  walk(nodes);
  const descendantCache = new Map<string, string[]>();
  function getDescendants(id: string): string[] {
    if (descendantCache.has(id)) return descendantCache.get(id)!;
    const children = childrenMap.get(id) ?? [];
    const result = [...children];
    children.forEach((childId) => {
      result.push(...getDescendants(childId));
    });
    descendantCache.set(id, result);
    return result;
  }
  return { nameMap, getDescendants };
}

function formatSkills(skills: unknown, tree: ServiceCategoryNode[]): string {
  if (!skills) return '-';
  const ids = Array.isArray(skills)
    ? skills.filter((x): x is string => typeof x === 'string')
    : [];
  if (ids.length === 0) return '-';
  const { nameMap, getDescendants } = buildTreeMaps(tree);
  const idSet = new Set(ids);
  const leafIds = ids.filter((id) => {
    const descendants = getDescendants(id);
    return !descendants.some((d) => idSet.has(d));
  });
  if (leafIds.length === 0) return '-';
  return leafIds.map((id) => nameMap.get(id) ?? id).join(' / ');
}

/**
 * 审核弹窗：上半部分展示师傅详情（只读），下半部分通过/拒绝操作。
 * - 默认为「待选择」状态，需点通过或拒绝按钮
 * - 拒绝时展开拒绝理由输入框
 */
function ReviewModal({
  open,
  master,
  catTree,
  loading,
  onClose,
  onApprove,
}: {
  open: boolean;
  master: MasterUser | null;
  catTree: ServiceCategoryNode[];
  loading: boolean;
  onClose: () => void;
  onApprove: (status: 'active' | 'disabled', reason?: string) => Promise<void> | void;
}) {
  const [action, setAction] = useState<'none' | 'approve' | 'reject'>('none');
  const [reason, setReason] = useState('');

  useEscClose(() => {
    if (!loading) onClose();
  });

  // 每次打开重置状态（通过/拒绝 选项 + 拒绝理由）
  useEffect(() => {
    if (open) {
      setAction('none');
      setReason('');
    }
  }, [open]);

  if (!open || !master) return null;

  const submit = async () => {
    if (action === 'none') return;
    const status = action === 'approve' ? 'active' : 'disabled';
    const reasonValue = action === 'reject' ? reason.trim() : undefined;
    if (action === 'reject' && !reasonValue) return;
    await onApprove(status, reasonValue);
  };

  const infoRow = (label: string, value: string | null | undefined) => (
    <div className="field" style={{ marginBottom: 4 }}>
      <div className="field-label" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--color-text-primary)', fontSize: 14 }}>
        {value || <span style={{ color: 'var(--color-text-soft)' }}>—</span>}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-panel modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>审核认证 · {master.realName}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          {/* 详情区域 */}
          <div
            style={{
              background: 'var(--color-bg-soft)',
              borderRadius: 8,
              padding: 14,
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 10 }}>基本信息</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>{infoRow('真实姓名', master.realName)}</div>
              <div style={{ flex: 1, minWidth: 120 }}>{infoRow('手机号', master.user?.phone)}</div>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>{infoRow('身份证号', master.idCard)}</div>
              <div style={{ flex: 1, minWidth: 120 }}>{infoRow('服务城市', master.city)}</div>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                {infoRow('实名认证', master.idVerified ? '已认证' : '未认证')}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                {infoRow('提交时间', formatDateTime(master.createdAt))}
              </div>
            </div>
            {infoRow('技能', formatSkills(master.skills, catTree))}
          </div>

          {/* 操作区域 */}
          <div className="field">
            <label className="field-label">审核结果</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className={action === 'approve' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setAction('approve')}
                disabled={loading}
                style={{ flex: 1 }}
              >
                通过
              </button>
              <button
                type="button"
                className={action === 'reject' ? 'btn-danger' : 'btn-secondary'}
                onClick={() => setAction('reject')}
                disabled={loading}
                style={{ flex: 1 }}
              >
                拒绝
              </button>
            </div>
          </div>

          {action === 'reject' && (
            <div className="field">
              <label className="field-label">拒绝理由</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请输入拒绝原因，方便师傅修改后重新提交"
                rows={3}
                disabled={loading}
              />
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            取消
          </button>
          <button
            type="button"
            className={action === 'reject' ? 'btn-danger' : 'btn-primary'}
            onClick={submit}
            disabled={
              loading ||
              action === 'none' ||
              (action === 'reject' && !reason.trim())
            }
          >
            {loading
              ? '提交中…'
              : action === 'approve'
                ? '确认通过'
                : action === 'reject'
                  ? '确认拒绝'
                  : '请选择审核结果'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerificationPage() {
  const [busy, setBusy] = useState(false);
  const [reviewItem, setReviewItem] = useState<MasterUser | null>(null);
  const toast = useToast();
  const qc = useQueryClient();

  const { data: rows = [], isLoading: loading } = useQuery<MasterUser[]>({
    queryKey: QK.adminPendingMasters,
    queryFn: getPendingMasters,
  });
  const { data: catTree = [], isLoading: catLoading } = useQuery({
    queryKey: ['categoryTree'],
    queryFn: getCategoryTree,
  });

  const handleApprove = async (status: 'active' | 'disabled', reason?: string) => {
    if (!reviewItem) return;
    setBusy(true);
    try {
      await approveMaster(reviewItem.id, status, reason);
      toast.success(status === 'active' ? '已通过认证' : '已拒绝');
      // 审核后从列表移除
      qc.setQueryData<MasterUser[]>(QK.adminPendingMasters, (prev) =>
        (prev ?? []).filter((r) => r.id !== reviewItem.id),
      );
      qc.invalidateQueries({ queryKey: QK.adminMasters });
      setReviewItem(null);
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<MasterUser>[] = [
    { key: 'realName', title: '姓名', render: (r) => r.realName || '-' },
    { key: 'phone', title: '手机号', render: (r) => r.user?.phone || '-' },
    { key: 'city', title: '服务城市', render: (r) => r.city || '-' },
    { key: 'idCard', title: '身份证', render: (r) => r.idCard || '-' },
    { key: 'createdAt', title: '提交时间', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'action',
      title: '操作',
      align: 'center',
      width: '100px',
      render: (r) => (
        <button
          type="button"
          className="btn-link"
          disabled={busy}
          onClick={() => setReviewItem(r)}
        >
          审核
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <h2>认证审核</h2>
        <span className="page-sub">待审核师傅 {rows.length} 人</span>
      </div>
      <div className="card card--bare">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading || catLoading}
          emptyText="暂无待审核的师傅"
        />
      </div>

      <ReviewModal
        open={!!reviewItem}
        master={reviewItem}
        catTree={catTree}
        loading={busy}
        onClose={() => !busy && setReviewItem(null)}
        onApprove={handleApprove}
      />
    </div>
  );
}
