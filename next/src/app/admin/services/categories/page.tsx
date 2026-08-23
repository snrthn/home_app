'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  setCategoryActive,
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

// 递归收集所有「含子级」的节点 id：用于彻底折叠整棵树（仅保留一级可见）
function collectCollapsible(
  nodes: (ServiceCategory & { children?: ServiceCategory[] })[],
): Set<string> {
  const out = new Set<string>();
  const walk = (list: (ServiceCategory & { children?: ServiceCategory[] })[]) => {
    list.forEach((n) => {
      if (n.children?.length) {
        out.add(n.id);
        walk(n.children);
      }
    });
  };
  walk(nodes);
  return out;
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
  // description/icon 可编辑（icon 支持 emoji 或自定义标识字符，直接展示）；
  // sort 进表单（可编辑排序权重）；启用状态改由列表操作栏维护，不在表单里
  description: string;
  icon: string;
  sort: string;
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
  const [icon, setIcon] = useState(initial.icon);
  const [description, setDescription] = useState(initial.description);
  const [sort, setSort] = useState<string>(initial.sort);
  const [saving, setSaving] = useState(false);

  useEscClose(onClose);

  // 可选上级：排除自身及其子孙，且只能挂在 level<3 的节点下（保证最多三级）。
  // 顺序按「类目树 DFS」展开，与类目列表完全展开时的缩进结构一致（父级始终排在其全部子孙之前），
  // 避免扁平后端排序把子级插到父级前面，导致选中某结构下的叶子结点时心智负担高。
  const parentOptions = useMemo(() => {
    const blocked = selfId ? collectSubtreeIds(allCategories, selfId) : new Set<string>();
    const tree = buildTree(allCategories);
    const out: { id: string; name: string; level: number }[] = [];
    const walk = (nodes: (ServiceCategory & { children?: ServiceCategory[] })[]) => {
      nodes.forEach((n) => {
        const level = n.level ?? 1;
        if (!blocked.has(n.id) && level < 3) {
          out.push({ id: n.id, name: n.name, level });
        }
        if (n.children?.length) walk(n.children);
      });
    };
    walk(tree);
    return out;
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
      // 名称、上级、图标、描述、排序均可编辑
      await onSubmit({
        name: name.trim(),
        parentId: parentId || null,
        description: description.trim() || '',
        icon: icon.trim(),
        sort,
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
          <div className="field">
            <label className="field-label">
              图标（可选）
              <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
                填 emoji 或字符，如 🧹 🔧 🛠️ 🏢
              </span>
            </label>
            <input
              className="input"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="如：🧹"
              style={{ fontFamily: 'inherit' }}
            />
            <p className="field-hint" style={{ marginTop: 6 }}>
              填 emoji 直接显示为小图标；也可以填文字（如 icon-clean），但前端会原样展示文字。
            </p>
          </div>
          <div className="field">
            <label className="field-label">描述（可选）</label>
            <textarea
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简短介绍该类目，用于列表说明或前端展示"
              rows={2}
            />
          </div>
          <div className="field">
            <label className="field-label">排序（数值越小越靠前）</label>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              placeholder="0"
            />
            <p className="field-hint" style={{ marginTop: 6 }}>
              类目列表按排序值从小到大排列（数值越小越靠前）；排序值相同时按创建时间。
            </p>
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

// 停启用确认弹窗：与「服务区域」保持同一范式
// 停用 → 整支向下同步停用；启用 → 默认只启用当前节点，需勾选才连带子级
function ActiveDialog({
  mode,
  name,
  descendantCount,
  cascade,
  onCascadeChange,
  loading,
  onCancel,
  onConfirm,
}: {
  mode: 'enable' | 'disable';
  name: string;
  descendantCount: number;
  cascade: boolean;
  onCascadeChange: (v: boolean) => void;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isEnable = mode === 'enable';
  useEscClose(onCancel);
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel modal-md">
        <div className="modal-header">
          <span>{isEnable ? '启用类目' : '停用类目'}</span>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <p style={{ marginTop: 0 }}>确定{isEnable ? '启用' : '停用'}「{name}」？</p>
          {!isEnable && descendantCount > 0 && (
            <p className="field-hint">
              将同时停用其下全部 {descendantCount} 个类目（共 {descendantCount + 1} 个）。停用后该类目及下级不再对外展示，可随时重新启用。
            </p>
          )}
          {isEnable && descendantCount > 0 && (
            <label
              className="checkbox-label"
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontWeight: 600, color: '#b45309' }}
            >
              <input type="checkbox" checked={cascade} onChange={(e) => onCascadeChange(e.target.checked)} />
              同时启用其下 {descendantCount} 个类目（默认只启用当前节点）
            </label>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? (isEnable ? '启用中…' : '停用中…') : isEnable ? '确认启用' : '确认停用'}
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
    // 进入/切回本页必拉最新，覆盖「在项目页新增后回到类目页」及多标签常开场景
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // 顺序完全由后端决定（sort 升序，相同则 createdAt），前端不做排序处理
  const tree = useMemo(() => buildTree(categories), [categories]);

  // 折叠状态：记录被折叠的节点 id，其子树不渲染
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const autoCollapsed = useRef(false);
  // 默认收起：数据首次到达后递归折叠所有含子级的节点（仅展开一级）。
  // 用 useEffect 而非 useState 惰性初始化——首次渲染时列表还是空数组，惰性初始值会被定格成空集。
  useEffect(() => {
    if (autoCollapsed.current || tree.length === 0) return;
    autoCollapsed.current = true;
    setCollapsed(collectCollapsible(tree));
  }, [tree]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allExpanded = collapsed.size === 0;
  // 折叠全部：递归收全部层级，避免只收最外层
  const toggleAll = () => setCollapsed(allExpanded ? collectCollapsible(tree) : new Set());

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
  const [activeTarget, setActiveTarget] = useState<ServiceCategory | null>(null);
  const [cascadeEnable, setCascadeEnable] = useState(false);
  const [acting, setActing] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: QK.adminServiceCategories });

  // 该类目下的未删除子级类目数量（用于删除前拦截）
  const childCountOf = (id: string) => categories.filter((c) => c.parentId === id).length;
  // 该类目下的全部子孙数量（不含自身），用于停启用弹窗提示
  const descendantCountOf = (id: string) => collectSubtreeIds(categories, id).size - 1;

  const handleCreate = async (dto: CategoryDraft) => {
    try {
      // 不传 isActive：新建类目默认启用（与「服务区域」开通后默认启用一致）
      await createServiceCategory({
        name: dto.name,
        parentId: dto.parentId,
        description: dto.description || undefined,
        icon: dto.icon || undefined,
        sort: Number(dto.sort),
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

  const handleToggleActive = async () => {
    if (!activeTarget) return;
    const enable = !activeTarget.isActive;
    setActing(true);
    try {
      // 停用时后端无条件整支停用；启用时是否连带子级由 cascadeEnable 决定
      await setCategoryActive(activeTarget.id, enable, enable ? cascadeEnable : true);
      toast.success(enable ? '类目已启用' : '类目已停用');
      setActiveTarget(null);
      setCascadeEnable(false);
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
      key: 'sort',
      title: '排序',
      width: '70px',
      align: 'center',
      render: (r) => r.node.sort,
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
      width: '230px',
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
          <button
            type="button"
            className={r.node.isActive ? 'btn-link btn-link-danger' : 'btn-link'}
            onClick={() => {
              setCascadeEnable(false);
              setActiveTarget(r.node);
            }}
          >
            {r.node.isActive ? '停用' : '启用'}
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

      <div className="card card--bare">
        <p className="field-hint" style={{ marginTop: -4, marginBottom: 14 }}>
          服务类目为树形结构（最多三级）：一级为业务域（如「家电清洗」「家电维修」），其下可挂二级、三级。
          默认仅展开一级类目，点击行首箭头可折叠/展开子节点。
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
          }}
          allCategories={categories}
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
          }}
          allCategories={categories}
          selfId={editItem.id}
          onClose={() => setEditItem(null)}
          onSubmit={(dto) => handleUpdate(editItem.id, dto)}
        />
      )}

      {activeTarget && (
        <ActiveDialog
          mode={activeTarget.isActive ? 'disable' : 'enable'}
          name={activeTarget.name}
          descendantCount={descendantCountOf(activeTarget.id)}
          cascade={cascadeEnable}
          onCascadeChange={setCascadeEnable}
          loading={acting}
          onCancel={() => {
            setActiveTarget(null);
            setCascadeEnable(false);
          }}
          onConfirm={handleToggleActive}
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
