'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMasters,
  setMasterStatus,
  getCategoryTree,
  type MasterUser,
  type ServiceCategoryNode,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import DataTable, { StatusBadge, type Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDateTime } from '@/lib/format';

const statusText: Record<string, { t: string; tone: 'green' | 'orange' | 'gray' | 'red' }> = {
  pending: { t: '待审核', tone: 'orange' },
  active: { t: '正常', tone: 'green' },
  disabled: { t: '禁用', tone: 'gray' },
};

// 把类目树拍平，得到 id->name 以及 id->所有后代 id 集合（用于判断某个选中节点是否为叶子选中）
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

/**
 * 渲染师傅技能：
 * - 最新格式为类目节点 id 数组（Json）。
 * - 只展示「用户选择的末尾标签」：在选中集合里，如果某个节点的后代也被选中，
 *   则只展示后代（叶子），父节点不再重复展示。
 */
function formatSkills(skills: unknown, tree: ServiceCategoryNode[]): string {
  if (!skills) return '-';
  const ids = Array.isArray(skills)
    ? skills.filter((x): x is string => typeof x === 'string')
    : [];
  if (ids.length === 0) return '-';

  const { nameMap, getDescendants } = buildTreeMaps(tree);
  const idSet = new Set(ids);

  // 只保留叶子选中：该节点没有后代也被选中
  const leafIds = ids.filter((id) => {
    const descendants = getDescendants(id);
    return !descendants.some((d) => idSet.has(d));
  });

  if (leafIds.length === 0) return '-';
  return leafIds.map((id) => nameMap.get(id) ?? id).join(' / ');
}

type MasterToggleStatus = 'active' | 'disabled';

export default function MasterListPage() {
  const qc = useQueryClient();
  // react-query 取数：同一 queryKey 的在途请求会被合并，避免初始化重复请求。
  const { data: rows = [], isLoading: loading } = useQuery<MasterUser[]>({
    queryKey: QK.adminMasters,
    queryFn: () => getMasters(),
  });
  const { data: catTree = [], isLoading: catLoading } = useQuery({
    queryKey: ['categoryTree'],
    queryFn: getCategoryTree,
  });
  const [kw, setKw] = useState('');

  const filtered = useMemo(
    () =>
      kw
        ? rows.filter(
            (r) =>
              r.realName.includes(kw) ||
              (r.user?.phone || '').includes(kw) ||
              (r.city || '').includes(kw),
          )
        : rows,
    [rows, kw],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: QK.adminMasters });

  // 停用 二次确认对话框的待确认项
  const [pending, setPending] = useState<{
    id: string;
    status: MasterToggleStatus;
    label: string;
    message: string;
  } | null>(null);

  // 启 / 停（pending 走审核流程，不在本处操作）
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: MasterToggleStatus }) =>
      setMasterStatus(v.id, v.status),
    onSuccess: () => {
      invalidate();
      setPending(null);
    },
  });

  const toggleStatus = (r: MasterUser) => {
    const next: MasterToggleStatus = r.status === 'active' ? 'disabled' : 'active';
    const label = next === 'disabled' ? '停用' : '启用';
    // 停用 / 启用：统一弹二次确认框，避免误操作
    const message = `确定${label}师傅「${r.realName}」？${
      next === 'disabled'
        ? '停用后该师傅将无法接单。'
        : '启用后该师傅将恢复接单权限。'
    }`;
    setPending({ id: r.id, status: next, label, message });
  };

  const columns: Column<MasterUser>[] = [
    { key: 'realName', title: '姓名', render: (r) => r.realName || '-' },
    { key: 'phone', title: '手机号', render: (r) => r.user?.phone || '-' },
    { key: 'city', title: '服务城市', render: (r) => r.city || '-' },
    { key: 'skills', title: '技能', render: (r) => formatSkills(r.skills, catTree) },
    { key: 'rating', title: '评分', render: (r) => Number(r.rating).toFixed(1) },
    { key: 'orderCount', title: '订单数', render: (r) => r.orderCount },
    {
      key: 'idVerified',
      title: '实名认证',
      render: (r) => (
        <StatusBadge tone={r.idVerified ? 'green' : 'orange'}>
          {r.idVerified ? '已认证' : '未认证'}
        </StatusBadge>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (r) => {
        const s = statusText[r.status] || { t: r.status, tone: 'gray' as const };
        return <StatusBadge tone={s.tone}>{s.t}</StatusBadge>;
      },
    },
    { key: 'createdAt', title: '注册时间', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'op',
      title: '操作',
      width: '90px',
      render: (r) => {
        if (r.status === 'pending') {
          return <span style={{ color: 'var(--color-text-soft)' }}>待审核</span>;
        }
        return (
          <button
            type="button"
            className={
              r.status === 'active' ? 'btn-link btn-link-danger' : 'btn-link'
            }
            onClick={() => toggleStatus(r)}
            disabled={statusMut.isPending}
          >
            {r.status === 'active' ? '停用' : '启用'}
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-head">
        <h2>师傅管理</h2>
      </div>
      <div className="card">
        <div className="toolbar">
          <input
            className="input toolbar-search"
            placeholder="搜索姓名 / 手机 / 城市"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
        </div>
        <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} loading={loading || catLoading} />
      </div>

      <ConfirmDialog
        open={!!pending}
        title="操作确认"
        message={pending?.message}
        confirmLabel={pending?.label}
        loading={statusMut.isPending}
        onConfirm={() => {
          if (pending) statusMut.mutate({ id: pending.id, status: pending.status });
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
