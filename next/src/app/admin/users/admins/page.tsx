'use client';

import { useMemo, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getAdmins,
  createAdmin,
  updateAdmin,
  setAdminStatus,
  getRbacRoles,
  type AdminUser,
  type StaffRole,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { useUserStore } from '@/lib/user-store';
import DataTable, { StatusBadge, type Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDateTime } from '@/lib/format';
import { useEscClose } from '@/lib/useEscClose';

const statusMeta: Record<
  string,
  { t: string; tone: 'green' | 'gray' | 'red' }
> = {
  active: { t: '正常', tone: 'green' },
  disabled: { t: '禁用', tone: 'gray' },
  frozen: { t: '冻结', tone: 'red' },
};

type AccountStatus = 'active' | 'disabled' | 'frozen';

export default function AdminListPage() {
  const qc = useQueryClient();
  // react-query 取数：同一 queryKey 的在途请求会被合并，React 18 严格模式
  // 下的「挂载→卸载→再挂载」不会再把接口打两遍。
  const { data: rows = [], isLoading: loading } = useQuery<AdminUser[]>({
    queryKey: QK.adminAdmins,
    queryFn: getAdmins,
  });
  // 内部岗位角色下拉数据源
  const { data: roles = [] } = useQuery<StaffRole[]>({
    queryKey: QK.rbacRoles,
    queryFn: getRbacRoles,
  });
  // 当前登录的后台账号 id（用于「改自己角色」二次确认）
  const currentUserId = useUserStore((s) => s.users.admin?.id);

  const [kw, setKw] = useState('');

  // 新增 / 编辑 弹窗状态
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [staffRoleId, setStaffRoleId] = useState('');
  const [err, setErr] = useState('');

  // Esc 关闭新增/编辑账号弹窗
  useEscClose(() => setOpen(false));

  const filtered = useMemo(
    () =>
      kw
        ? rows.filter(
            (r) =>
              r.phone.includes(kw) || (r.profile?.nickname || '').includes(kw),
          )
        : rows,
    [rows, kw],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.adminAdmins });
    qc.invalidateQueries({ queryKey: QK.rbacRoles });
  };

  // 保存前：若正在修改「自己的角色」且角色发生变化，需二次确认
  const [roleChangePending, setRoleChangePending] = useState(false);

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? updateAdmin(editing.id, {
            nickname: nickname || undefined,
            password: password || undefined,
            staffRoleId: staffRoleId || null,
          })
        : createAdmin({
            phone,
            password,
            nickname: nickname || undefined,
            staffRoleId: staffRoleId || null,
          }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
    },
    onError: (e: any) =>
      setErr(e?.response?.data?.message || e?.message || '保存失败'),
  });

  const handleSave = () => {
    if (
      editing &&
      currentUserId &&
      editing.id === currentUserId &&
      (staffRoleId || null) !== (editing.staffRole?.id || null)
    ) {
      setRoleChangePending(true);
      return;
    }
    saveMut.mutate();
  };

  // 停用 / 冻结 二次确认对话框的待确认项
  const [pending, setPending] = useState<{
    id: string;
    status: AccountStatus;
    label: string;
    message: string;
  } | null>(null);

  // 启 / 停 / 冻结
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: AccountStatus }) =>
      setAdminStatus(v.id, v.status),
    onSuccess: () => {
      invalidate();
      setPending(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setPhone('');
    setNickname('');
    setPassword('');
    setStaffRoleId('');
    setErr('');
    setOpen(true);
  };
  const openEdit = (r: AdminUser) => {
    setEditing(r);
    setPhone(r.phone);
    setNickname(r.profile?.nickname || '');
    setPassword('');
    setStaffRoleId(r.staffRole?.id || '');
    setErr('');
    setOpen(true);
  };
  const toggleStatus = (r: AdminUser) => {
    const next: AccountStatus = r.status === 'active' ? 'disabled' : 'active';
    const label =
      next === 'disabled' ? '停用' : r.status === 'disabled' ? '启用' : '解冻';
    // 启用 / 解冻 / 停用：统一弹二次确认框，避免误操作
    const message = `确定${label}「${r.profile?.nickname || r.phone}」？${
      next === 'disabled'
        ? '停用后该账号将无法登录。'
        : next === 'active'
        ? '启用后该账号将恢复登录权限。'
        : ''
    }`;
    setPending({ id: r.id, status: next, label, message });
  };

  const columns: Column<AdminUser>[] = [
    { key: 'nickname', title: '昵称', render: (r) => r.profile?.nickname || '-' },
    { key: 'phone', title: '账号(手机)' },
    {
      key: 'status',
      title: '状态',
      render: (r) => {
        const s = statusMeta[r.status] || { t: r.status, tone: 'gray' as const };
        return <StatusBadge tone={s.tone}>{s.t}</StatusBadge>;
      },
    },
    {
      key: 'role',
      title: '内部角色',
      render: (r) =>
        r.staffRole?.name ?? (
          <span style={{ color: 'var(--color-text-soft)' }}>未分配</span>
        ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      render: (r) => formatDateTime(r.createdAt),
    },
    {
      key: 'op',
      title: '操作',
      width: '130px',
      render: (r) => (
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn-link" onClick={() => openEdit(r)}>
            编辑
          </button>
          <button
            type="button"
            className={
              r.status === 'active' ? 'btn-link btn-link-danger' : 'btn-link'
            }
            onClick={() => toggleStatus(r)}
            disabled={statusMut.isPending || r.id === currentUserId}
            title={
              r.id === currentUserId ? '不能停用当前登录的账号' : undefined
            }
          >
            {r.status === 'active' ? '停用' : '启用'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <h2>后台账号</h2>
      </div>
      <div className="card">
        <div className="toolbar">
          <input
            className="input toolbar-search"
            placeholder="搜索手机 / 昵称"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
          <button type="button" className="btn-primary" onClick={openCreate}>
            + 新增账号
          </button>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          loading={loading}
        />
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

      <ConfirmDialog
        open={roleChangePending}
        title="修改自身角色"
        message="你正在修改自己的内部岗位角色，保存后当前账号的权限集合将立即变化，可能影响你后续的操作权限。确定继续？"
        confirmLabel="仍然修改"
        loading={saveMut.isPending}
        onConfirm={() => {
          setRoleChangePending(false);
          saveMut.mutate();
        }}
        onCancel={() => setRoleChangePending(false)}
      />

      {open && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>{editing ? '编辑账号' : '新增后台账号'}</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setOpen(false)}
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
                <label className="field-label">手机号</label>
                <input
                  className="input"
                  value={phone}
                  disabled={!!editing}
                  placeholder="11 位手机号"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">昵称</label>
                <input
                  className="input"
                  value={nickname}
                  placeholder="选填"
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">内部岗位角色</label>
                <select
                  className="input"
                  value={staffRoleId}
                  onChange={(e) => setStaffRoleId(e.target.value)}
                >
                  <option value="">未分配</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label">
                  {editing ? '重置密码（留空则不修改）' : '初始密码'}
                </label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  placeholder={editing ? '留空保持不变' : '至少 6 位'}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={
                  saveMut.isPending || (!editing && (!phone || !password))
                }
              >
                {saveMut.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
