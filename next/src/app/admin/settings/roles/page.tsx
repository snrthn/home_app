'use client';

import { useState } from 'react';
import { useEscClose } from '@/lib/useEscClose';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getRbacRoles,
  getRbacPermissions,
  createRbacRole,
  updateRbacRole,
  deleteRbacRole,
  setRbacRolePermissions,
  type StaffRole,
  type Permission,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import DataTable, { type Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';

const disabledStyle = { opacity: 0.4, pointerEvents: 'none' } as const;

export default function RoleManagePage() {
  const qc = useQueryClient();
  const { data: roles = [], isLoading } = useQuery<StaffRole[]>({
    queryKey: QK.rbacRoles,
    queryFn: getRbacRoles,
  });
  const { data: permGroups = {} } = useQuery<Record<string, Permission[]>>({
    queryKey: QK.rbacPermissions,
    queryFn: getRbacPermissions,
  });

  const [view, setView] = useState<'list' | 'perms'>('list');
  const [activeRole, setActiveRole] = useState<StaffRole | null>(null);
  // Esc 关闭所有弹窗
  useEscClose(() => {
    setModal(null);
    setActiveRole(null);
  });

  // 新增 / 编辑 弹窗
  const [modal, setModal] = useState<
    null | { mode: 'create' } | { mode: 'edit'; role: StaffRole }
  >(null);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');

  // 删除确认
  const [delTarget, setDelTarget] = useState<StaffRole | null>(null);

  // 权限勾选态
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [permErr, setPermErr] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.rbacRoles });
    qc.invalidateQueries({ queryKey: QK.rbacPermissions });
  };

  const openCreate = () => {
    setKey('');
    setName('');
    setDescription('');
    setErr('');
    setModal({ mode: 'create' });
  };
  const openEdit = (role: StaffRole) => {
    setKey(role.key);
    setName(role.name);
    setDescription(role.description || '');
    setErr('');
    setModal({ mode: 'edit', role });
  };

  const saveRoleMut = useMutation({
    mutationFn: () =>
      modal?.mode === 'edit'
        ? updateRbacRole(modal.role.id, { name, description })
        : createRbacRole({ key, name, description }),
    onSuccess: () => {
      invalidate();
      setModal(null);
    },
    onError: (e: any) =>
      setErr(e?.response?.data?.message || e?.message || '保存失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRbacRole(id),
    onSuccess: () => {
      invalidate();
      setDelTarget(null);
    },
  });

  const openPerms = (role: StaffRole) => {
    setActiveRole(role);
    setChecked(new Set(role.permissions.map((p) => p.code)));
    setPermErr('');
    setView('perms');
  };

  const savePermsMut = useMutation({
    mutationFn: () =>
      setRbacRolePermissions(activeRole!.id, Array.from(checked)),
    onSuccess: () => {
      invalidate();
      setView('list');
    },
    onError: (e: any) =>
      setPermErr(e?.response?.data?.message || e?.message || '保存失败'),
  });

  // ===================== 权限编辑视图 =====================
  if (view === 'perms' && activeRole) {
    const groups = Object.entries(permGroups);
    return (
      <div>
        <div
          className="page-head"
          style={{ display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setView('list')}
          >
            ← 返回
          </button>
          <h2 style={{ margin: 0 }}>权限设置 · {activeRole.name}</h2>
        </div>
        {activeRole.isSystem && (
          <p style={{ color: 'var(--color-text-soft)' }}>
            系统角色权限为内置只读，不可修改。
          </p>
        )}
        {permErr && (
          <p style={{ color: '#c0392b', margin: '0 0 12px' }}>{permErr}</p>
        )}
        <div style={{ display: 'grid', gap: 16 }}>
          {groups.length === 0 && (
            <div className="card">
              <EmptyState text="暂无权限数据。" />
            </div>
          )}
          {groups.map(([group, perms]) => (
            <div className="card" key={group}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{group}</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 8,
                }}
              >
                {perms.map((p) => (
                  <label
                    key={p.id}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      fontSize: 14,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(p.code)}
                      disabled={activeRole.isSystem}
                      onChange={(e) => {
                        const next = new Set(checked);
                        if (e.target.checked) next.add(p.code);
                        else next.delete(p.code);
                        setChecked(next);
                      }}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {!activeRole.isSystem && (
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setView('list')}
            >
              取消
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => savePermsMut.mutate()}
              disabled={savePermsMut.isPending}
            >
              {savePermsMut.isPending ? '保存中...' : '保存权限'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ===================== 列表视图 =====================
  const columns: Column<StaffRole>[] = [
    { key: 'name', title: '角色名称', render: (r) => r.name },
    { key: 'key', title: '标识', render: (r) => <code>{r.key}</code> },
    {
      key: 'userCount',
      title: '用户数',
      render: (r) => r.userCount,
    },
    {
      key: 'permCount',
      title: '权限数',
      render: (r) => r.permissions.length,
    },
    {
      key: 'isSystem',
      title: '类型',
      render: (r) => (r.isSystem ? '系统内置' : '自定义'),
    },
    {
      key: 'op',
      title: '操作',
      width: '220px',
      render: (r) => (
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            className="btn-link"
            disabled={r.isSystem}
            style={r.isSystem ? disabledStyle : undefined}
            onClick={() => openEdit(r)}
          >
            编辑
          </button>
          <button
            type="button"
            className="btn-link"
            disabled={r.isSystem}
            style={r.isSystem ? disabledStyle : undefined}
            onClick={() => openPerms(r)}
          >
            权限
          </button>
          <button
            type="button"
            className="btn-link btn-link-danger"
            disabled={r.isSystem || r.userCount > 0}
            style={r.isSystem || r.userCount > 0 ? disabledStyle : undefined}
            onClick={() => setDelTarget(r)}
            title={
              r.isSystem
                ? '系统角色不可删除'
                : r.userCount > 0
                  ? '仍有后台账号绑定，无法删除'
                  : '删除角色'
            }
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
        <h2>角色权限</h2>
      </div>
      <div className="card card--bare">
        <div className="toolbar">
          <span style={{ color: 'var(--color-text-soft)' }}>
            管理后台账号的内部岗位角色与权限分配
          </span>
          <button type="button" className="btn-primary" onClick={openCreate}>
            + 新建角色
          </button>
        </div>
        <DataTable
          columns={columns}
          rows={roles}
          rowKey={(r) => r.id}
          loading={isLoading}
        />
      </div>

      {/* 新增 / 编辑 角色弹窗 */}
      {modal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>{modal.mode === 'edit' ? '编辑角色' : '新建角色'}</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModal(null)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {err && (
                <p style={{ color: '#c0392b', margin: '0 0 12px' }}>{err}</p>
              )}
              <div className="field">
                <label className="field-label">角色标识(key)</label>
                <input
                  className="input"
                  value={key}
                  disabled={modal.mode === 'edit'}
                  placeholder="英文标识，如 ops_lead"
                  onChange={(e) => setKey(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">角色名称</label>
                <input
                  className="input"
                  value={name}
                  placeholder="如 运营主管"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">描述</label>
                <input
                  className="input"
                  value={description}
                  placeholder="选填"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setModal(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => saveRoleMut.mutate()}
                disabled={
                  saveRoleMut.isPending || !name || (modal.mode === 'create' && !key)
                }
              >
                {saveRoleMut.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!delTarget}
        title="删除角色"
        message={`确定删除角色「${delTarget?.name}」？此操作不可恢复。`}
        confirmLabel="删除"
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (delTarget) deleteMut.mutate(delTarget.id);
        }}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
