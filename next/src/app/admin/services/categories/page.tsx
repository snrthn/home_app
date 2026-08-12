'use client';

import { useMemo, useState } from 'react';
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
import { useEscClose } from '@/lib/useEscClose';

// 把扁平类目列表组装成嵌套树（最多三级），与后端 getCategoryTree 同算法
function buildTree(flat: ServiceCategory[]): (ServiceCategory & { children?: ServiceCategory[] })[] {
  const map = new Map<string, ServiceCategory & { children?: ServiceCategory[] }>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: (ServiceCategory & { children?: ServiceCategory[] })[] = [];
  flat.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// 收集某节点下的全部子孙 id（含自身），用于编辑时禁止选自己/子孙当上级
function collectSubtreeIds(flat: ServiceCategory[], rootId: string): Set<string> {
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    flat.forEach((c) => {
      if (c.parentId === id) stack.push(c.id);
    });
  }
  return out;
}

interface CategoryDraft {
  name: string;
  parentId: string | null;
  // 以下字段不进表单，仅编辑时透传原值，避免保存时把已有描述等清空
  description: string;
  icon: string;
  sort: string;
  isActive: boolean;
}

function CategoryEditModal({
  title,
  initial,
  allCategories,
  selfId,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: CategoryDraft;
  allCategories: ServiceCategory[];
  selfId?: string;
  onClose: () => void;
  onSubmit: (dto: CategoryDraft) => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(initial.name);
  const [parentId, setParentId] = useState<string>(initial.parentId ?? '');
  const [isActive, setIsActive] = useState<boolean>(initial.isActive);
  const [saving, setSaving] = useState(false);

  useEscClose(onClose);

  // 可选上级：排除自身及其子孙，且只能挂在 level<3 的节点下（保证最多三级）
  const parentOptions = useMemo(() => {
    const blocked = selfId ? collectSubtreeIds(allCategories, selfId) : new Set<string>();
    return allCategories
      .filter((c) => !blocked.has(c.id) && (c.level ?? 1) < 3)
      .sort((a, b) => (a.level ?? 1) - (b.level ?? 1) || a.sort - b.sort);
  }, [allCategories, selfId]);

  const effectiveLevel = parentId
    ? (parentOptions.find((c) => c.id === parentId)?.level ?? 1) + 1
    : 1;

  const submit = async () => {
    if (!name.trim()) {
      toast.warning('请填写类目名称');
      return;
    }
    setSaving(true);
    try {
      // 只改名称与上级；其余字段透传原值，不破坏已有数据
      // 工种仅在一级类目（业务域）可设，子级继承，故子级提交时置空由后端回溯派生
      await onSubmit({
        name: name.trim(),
        parentId: parentId || null,
        description: initial.description,
        icon: initial.icon,
        sort: initial.sort,
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
      <div className="modal-panel modal-md">
        <div className="modal-header">
          <span>{title}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">上级类目（留空 = 顶级类目）</label>
            <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">（顶级类目）</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {'　'.repeat((c.level ?? 1) - 1)}
                  {c.name}
                </option>
              ))}
            </select>
            <p className="field-hint" style={{ marginTop: 6 }}>
              即将创建为第 <b>{effectiveLevel}</b> 级类目（最多三级）。
            </p>
          </div>
          <div className="field">
            <label className="field-label">类目名称</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：家电维修 / 家政保洁"
              autoFocus
            />
          </div>
          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            启用（在前台类目树中可见）
          </label>
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

  // 统一排序：树与上级类目下拉都按「层级 → 排序值」排列，保证顺序一致
  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) => (a.level ?? 1) - (b.level ?? 1) || (a.sort ?? 0) - (b.sort ?? 0),
      ),
    [categories],
  );
  const tree = useMemo(() => buildTree(sortedCategories), [sortedCategories]);

  // 折叠状态：记录被折叠的节点 id，其子树不渲染
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allExpanded = collapsed.size === 0;
  const toggleAll = () => setCollapsed(allExpanded ? new Set(tree.map((n) => n.id)) : new Set());

  // 展平为带层级的表格行（尊重折叠状态）
  const rows = useMemo(() => {
    const out: { node: ServiceCategory; depth: number; hasChildren: boolean; isCollapsed: boolean }[] = [];
    const walk = (nodes: (ServiceCategory & { children?: ServiceCategory[] })[], depth: number) => {
      nodes.forEach((n) => {
        const hasChildren = !!n.children?.length;
        out.push({ node: n, depth, hasChildren, isCollapsed: collapsed.has(n.id) });
        if (hasChildren && !collapsed.has(n.id)) walk(n.children!, depth + 1);
      });
    };
    walk(tree, 0);
    return out;
  }, [tree, collapsed]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<ServiceCategory | null>(null);
  const [confirm, setConfirm] = useState<ServiceCategory | null>(null);
  const [acting, setActing] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: QK.adminServiceCategories });

  // 该类目下的未删除子级类目数量（用于删除前拦截）
  const childCountOf = (id: string) => categories.filter((c) => c.parentId === id).length;

  const handleCreate = async (dto: CategoryDraft) => {
    try {
      await createServiceCategory({
        name: dto.name,
        parentId: dto.parentId,
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
        parentId: dto.parentId,
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

  const columns: Column<{ node: ServiceCategory; depth: number; hasChildren: boolean; isCollapsed: boolean }>[] = [
    {
      key: 'name',
      title: '类目名称',
      width: '300px',
      render: (r) => (
        <span
          className="cell-ellipsis"
          title={r.node.name}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingLeft: r.depth * 20 }}
        >
          {r.hasChildren ? (
            <button
              type="button"
              className="tree-toggle"
              onClick={() => toggle(r.node.id)}
              aria-label={r.isCollapsed ? '展开' : '折叠'}
            >
              {r.isCollapsed ? '▸' : '▾'}
            </button>
          ) : (
            <span className="tree-toggle tree-toggle-placeholder" />
          )}
          {r.node.icon ? <span style={{ fontSize: 16, flexShrink: 0 }}>{r.node.icon}</span> : null}
          <span style={{ fontWeight: 600 }}>{r.node.name}</span>
        </span>
      ),
    },
    {
      key: 'level',
      title: '层级',
      width: '80px',
      align: 'center',
      render: (r) => r.node.level ?? 1,
    },
    {
      key: 'count',
      title: '项目数',
      width: '90px',
      align: 'center',
      render: (r) => r.node._count?.items ?? 0,
    },
    {
      key: 'isActive',
      title: '状态',
      width: '90px',
      render: (r) => (
        <StatusBadge tone={r.node.isActive ? 'green' : 'gray'}>
          {r.node.isActive ? '启用' : '停用'}
        </StatusBadge>
      ),
    },
    {
      key: 'op',
      title: '操作',
      width: '170px',
      render: (r) => (
        <div className="row-actions">
          <button
            type="button"
            className="btn-link"
            disabled={(r.node.level ?? 1) >= 3}
            title={(r.node.level ?? 1) >= 3 ? '已达三级上限，无法再新增子级' : '以该类目为上级新增子级'}
            onClick={() => {
              setCreateParentId(r.node.id);
              setCreateOpen(true);
            }}
          >
            新增子级
          </button>
          <button type="button" className="btn-link" onClick={() => setEditItem(r.node)}>
            编辑
          </button>
          <button
            type="button"
            className="btn-link btn-link-danger"
            onClick={() => setConfirm(r.node)}
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
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          <button type="button" className="btn-secondary btn-md" onClick={toggleAll}>
            {allExpanded ? '折叠全部' : '展开全部'}
          </button>
          <button
            type="button"
            className="btn-primary btn-md"
            onClick={() => {
              setCreateParentId(null);
              setCreateOpen(true);
            }}
          >
            + 新增类目
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <p className="field-hint" style={{ marginTop: -4, marginBottom: 14 }}>
          服务类目为树形结构（最多三级）：一级为业务域（如「家电清洗」「家电维修」），其下可挂二级、三级。
          一级类目可设置「工种」（在编辑中维护），其下所有服务项目自动继承该工种。点击行首箭头可折叠/展开子节点。
        </p>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.node.id}
          loading={loading}
          emptyText="暂无服务类目，点击右上角「新增类目」开始维护"
        />
      </div>

      {createOpen && (
        <CategoryEditModal
          title={createParentId ? '新增子级类目' : '新增服务类目'}
          initial={{
            name: '',
            parentId: createParentId,
            description: '',
            icon: '',
            sort: '0',
            isActive: true,
          }}
          allCategories={sortedCategories}
          onClose={() => {
            setCreateOpen(false);
            setCreateParentId(null);
          }}
          onSubmit={handleCreate}
        />
      )}

      {editItem && (
        <CategoryEditModal
          key={editItem.id}
          title={`编辑类目 · ${editItem.name}`}
          initial={{
            name: editItem.name,
            parentId: editItem.parentId ?? null,
            description: editItem.description ?? '',
            icon: editItem.icon ?? '',
            sort: String(editItem.sort),
            isActive: editItem.isActive,
          }}
          allCategories={sortedCategories}
          selfId={editItem.id}
          onClose={() => setEditItem(null)}
          onSubmit={(dto) => handleUpdate(editItem.id, dto)}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title="删除该类目"
        message={
          confirm
            ? childCountOf(confirm.id) > 0
              ? `该类目下仍有 ${childCountOf(confirm.id)} 个子级类目，请先删除子节点后再删除。`
              : (confirm._count?.items ?? 0) > 0
                ? `该类目下仍有 ${confirm._count?.items} 个服务项目，请先移除项目后再删除。`
                : '删除后不可恢复，确定删除该类目？'
            : ''
        }
        confirmDisabled={
          !!confirm && (childCountOf(confirm.id) > 0 || (confirm._count?.items ?? 0) > 0)
        }
        confirmLabel="确认删除"
        loading={acting}
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
