'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  type ServiceCategory,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { StatusBadge } from '@/components/admin/DataTable';
import DataTable, { type Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface CategoryDraft {
  name: string;
  description: string;
  icon: string;
  sort: string;
  isActive: boolean;
}

function CategoryEditModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: CategoryDraft;
  onClose: () => void;
  onSubmit: (dto: CategoryDraft) => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [icon, setIcon] = useState(initial.icon);
  const [sort, setSort] = useState(initial.sort);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.warning('请填写类目名称');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        icon: icon.trim(),
        sort: sort === '' ? '0' : sort,
        isActive,
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
      <div className="modal-panel">
        <div className="modal-header">
          <span>{title}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">类目名称</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：家电维修 / 家政保洁"
            />
          </div>
          <div className="field">
            <label className="field-label">图标（可选，填 emoji 或图标类名）</label>
            <input
              className="input"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="如：🔧"
            />
          </div>
          <div className="field">
            <label className="field-label">描述（可选）</label>
            <textarea
              className="input"
              style={{ minHeight: 56 }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="一句话说明该类目覆盖的服务范围"
            />
          </div>
          <div className="field-row" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="field-label">排序（越小越靠前）</label>
              <input
                className="input"
                type="number"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              />
            </div>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              启用
            </label>
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

export default function ServiceCategoriesPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const { data: categories = [], isLoading: loading } = useQuery<ServiceCategory[]>({
    queryKey: QK.adminServiceCategories,
    queryFn: () => getServiceCategories(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ServiceCategory | null>(null);
  const [confirm, setConfirm] = useState<ServiceCategory | null>(null);
  const [acting, setActing] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: QK.adminServiceCategories });

  const handleCreate = async (dto: CategoryDraft) => {
    try {
      await createServiceCategory({
        name: dto.name,
        description: dto.description || undefined,
        icon: dto.icon || undefined,
        sort: Number(dto.sort),
        isActive: dto.isActive,
      });
      toast.success('类目已创建');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      throw e;
    }
  };

  const handleUpdate = async (id: string, dto: CategoryDraft) => {
    try {
      await updateServiceCategory(id, {
        name: dto.name,
        description: dto.description || undefined,
        icon: dto.icon || undefined,
        sort: Number(dto.sort),
        isActive: dto.isActive,
      });
      toast.success('类目已保存');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      throw e;
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setActing(true);
    try {
      await deleteServiceCategory(confirm.id);
      toast.success('类目已删除');
      setConfirm(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setActing(false);
    }
  };

  const columns: Column<ServiceCategory>[] = [
    {
      key: 'name',
      title: '类目名称',
      width: '280px',
      render: (r) => (
        <span className="cell-ellipsis" title={r.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {r.icon ? <span style={{ fontSize: 16, flexShrink: 0 }}>{r.icon}</span> : null}
          <span style={{ fontWeight: 600 }}>{r.name}</span>
        </span>
      ),
    },
    {
      key: 'description',
      title: '描述',
      render: (r) =>
        r.description ? (
          <span className="cell-ellipsis" title={r.description}>{r.description}</span>
        ) : (
          <span style={{ color: '#b6c0c8' }}>—</span>
        ),
    },
    { key: 'sort', title: '排序', width: '140px', align: 'center', render: (r) => r.sort },
    { key: 'count', title: '项目数', width: '160px', align: 'center', render: (r) => r._count?.items ?? 0 },
    { key: 'isActive', title: '状态', width: '160px', render: (r) => (
      <StatusBadge tone={r.isActive ? 'green' : 'gray'}>{r.isActive ? '启用' : '停用'}</StatusBadge>
    ) },
    {
      key: 'op',
      title: '操作',
      width: '130px',
      render: (r) => (
        <div className="row-actions">
          <button type="button" className="btn-link" onClick={() => setEditItem(r)}>
            编辑
          </button>
          <button
            type="button"
            className="btn-link btn-link-danger"
            onClick={() => setConfirm(r)}
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <h2>服务类目</h2>
        <button
          type="button"
          className="btn-primary btn-md"
          style={{ marginLeft: 'auto' }}
          onClick={() => setCreateOpen(true)}
        >
          + 新增类目
        </button>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <p className="field-hint" style={{ marginTop: -4, marginBottom: 14 }}>
          服务类目是服务项目的上级分组（如「家电维修」「家政保洁」）。删除类目前须先清空其下所有服务项目，避免项目变孤儿。
        </p>
        <DataTable
          columns={columns}
          rows={categories}
          rowKey={(r) => r.id}
          loading={loading}
          emptyText="暂无服务类目，点击右上角「新增类目」开始维护"
        />
      </div>

      {createOpen && (
        <CategoryEditModal
          title="新增服务类目"
          initial={{ name: '', description: '', icon: '', sort: '0', isActive: true }}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {editItem && (
        <CategoryEditModal
          key={editItem.id}
          title={`编辑类目 · ${editItem.name}`}
          initial={{
            name: editItem.name,
            description: editItem.description ?? '',
            icon: editItem.icon ?? '',
            sort: String(editItem.sort),
            isActive: editItem.isActive,
          }}
          onClose={() => setEditItem(null)}
          onSubmit={(dto) => handleUpdate(editItem.id, dto)}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title="删除该类目"
        message={
          confirm && (confirm._count?.items ?? 0) > 0
            ? `该类目下仍有 ${confirm._count?.items} 个服务项目，请先移除项目后再删除。`
            : '删除后不可恢复，确定删除该类目？'
        }
        confirmLabel="确认删除"
        loading={acting}
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
