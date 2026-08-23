'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCustomers,
  setCustomerStatus,
  type CustomerUser,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import DataTable, { StatusBadge, type Column } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import DetailModal, { DetailRow } from '@/components/admin/DetailModal';
import { formatDateTime } from '@/lib/format';

const genderText = (g?: string | null) =>
  g === 'male' ? '男' : g === 'female' ? '女' : '未知';

type CustomerStatus = 'active' | 'disabled' | 'frozen';

export default function CustomerListPage() {
  const qc = useQueryClient();
  // react-query 取数：同一 queryKey 的在途请求会被合并，避免初始化重复请求。
  const { data: rows = [], isLoading: loading } = useQuery<CustomerUser[]>({
    queryKey: QK.adminCustomers,
    queryFn: getCustomers,
  });
  const [kw, setKw] = useState('');

  const filtered = useMemo(
    () =>
      kw
        ? rows.filter(
            (r) =>
              r.phone.includes(kw) ||
              (r.profile?.nickname || '').includes(kw) ||
              (r.profile?.realName || '').includes(kw),
          )
        : rows,
    [rows, kw],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: QK.adminCustomers });

  // 停用 二次确认对话框的待确认项
  const [pending, setPending] = useState<{
    id: string;
    status: CustomerStatus;
    label: string;
    message: string;
  } | null>(null);

  // 详情弹窗
  const [detailItem, setDetailItem] = useState<CustomerUser | null>(null);

  // 启 / 停（冻结也归到「启用」恢复为正常态）
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: CustomerStatus }) =>
      setCustomerStatus(v.id, v.status),
    onSuccess: () => {
      invalidate();
      setPending(null);
    },
  });

  const toggleStatus = (r: CustomerUser) => {
    const next: CustomerStatus = r.status === 'active' ? 'disabled' : 'active';
    const label = next === 'disabled' ? '停用' : '启用';
    // 停用 / 启用：统一弹二次确认框，避免误操作
    const message = `确定${label}客户「${r.profile?.nickname || r.phone}」？${
      next === 'disabled'
        ? '停用后该客户将无法登录。'
        : '启用后该客户将恢复登录权限。'
    }`;
    setPending({ id: r.id, status: next, label, message });
  };

  const columns: Column<CustomerUser>[] = [
    { key: 'nickname', title: '昵称', render: (r) => r.profile?.nickname || '-' },
    { key: 'phone', title: '手机号' },
    { key: 'realName', title: '真实姓名', render: (r) => r.profile?.realName || '-' },
    { key: 'gender', title: '性别', render: (r) => genderText(r.profile?.gender) },
    { key: 'city', title: '城市', render: (r) => r.profile?.city || '-' },
    { key: 'vip', title: '会员', render: (r) => `Lv.${r.profile?.vipLevel ?? 0}` },
    { key: 'points', title: '积分', render: (r) => r.profile?.points ?? 0 },
    { key: 'credit', title: '信用分', render: (r) => r.profile?.creditScore ?? 100 },
    {
      key: 'status',
      title: '状态',
      render: (r) => (
        <StatusBadge
          tone={r.status === 'active' ? 'green' : r.status === 'frozen' ? 'red' : 'gray'}
        >
          {r.status === 'active' ? '正常' : r.status === 'frozen' ? '冻结' : '禁用'}
        </StatusBadge>
      ),
    },
    { key: 'orders', title: '订单数', render: (r) => r._count?.customerOrders ?? 0 },
    { key: 'createdAt', title: '注册时间', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'op',
      title: '操作',
      width: '120px',
      render: (r) => (
        <div className="row-actions">
          <button type="button" className="btn-link" onClick={() => setDetailItem(r)}>
            详情
          </button>
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
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <h2>客户管理</h2>
      </div>
      <div className="card card--bare">
        <div className="toolbar">
          <input
            className="input toolbar-search"
            placeholder="搜索手机 / 昵称 / 姓名"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
        </div>
        <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} loading={loading} />
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

      {detailItem && (
        <DetailModal
          open={!!detailItem}
          title={`客户详情 · ${detailItem.profile?.nickname || detailItem.phone}`}
          onClose={() => setDetailItem(null)}
        >
          <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
            <DetailRow label="手机号" value={detailItem.phone} />
            <DetailRow label="状态">
              <StatusBadge
                tone={detailItem.status === 'active' ? 'green' : detailItem.status === 'frozen' ? 'red' : 'gray'}
              >
                {detailItem.status === 'active' ? '正常' : detailItem.status === 'frozen' ? '冻结' : '禁用'}
              </StatusBadge>
            </DetailRow>
          </div>
          <DetailRow label="昵称" value={detailItem.profile?.nickname || null} />
          <DetailRow label="真实姓名" value={detailItem.profile?.realName || null} />
          <div style={{ display: 'flex', gap: 16 }}>
            <DetailRow label="性别" value={genderText(detailItem.profile?.gender)} />
            <DetailRow label="所在城市" value={detailItem.profile?.city || null} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <DetailRow label="会员等级" value={`Lv.${detailItem.profile?.vipLevel ?? 0}`} />
            <DetailRow label="积分" value={detailItem.profile?.points ?? 0} />
            <DetailRow label="信用分" value={detailItem.profile?.creditScore ?? 100} />
          </div>
          <DetailRow label="订单数" value={detailItem._count?.customerOrders ?? 0} />
          <DetailRow label="注册时间" value={formatDateTime(detailItem.createdAt)} />
        </DetailModal>
      )}
    </div>
  );
}
