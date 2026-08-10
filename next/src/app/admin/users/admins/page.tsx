'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdmins, type AdminUser } from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import DataTable, { StatusBadge, type Column } from '@/components/admin/DataTable';
import { formatDateTime } from '@/lib/format';

export default function AdminListPage() {
  // react-query 取数：同一 queryKey 的在途请求会被合并，
  // React 18 严格模式(dev) 的「挂载→卸载→再挂载」不会再把接口打两遍。
  const { data: rows = [], isLoading: loading } = useQuery<AdminUser[]>({
    queryKey: QK.adminAdmins,
    queryFn: getAdmins,
  });
  const [kw, setKw] = useState('');

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

  const columns: Column<AdminUser>[] = [
    { key: 'nickname', title: '昵称', render: (r) => r.profile?.nickname || '-' },
    { key: 'phone', title: '账号(手机)' },
    {
      key: 'status',
      title: '状态',
      render: (r) => (
        <StatusBadge tone={r.status === 'active' ? 'green' : 'gray'}>
          {r.status === 'active' ? '正常' : '禁用'}
        </StatusBadge>
      ),
    },
    { key: 'createdAt', title: '创建时间', render: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <div>
      <div className="page-head">
        <h2>平台管理员</h2>
      </div>
      <div className="card">
        <div className="toolbar">
          <input
            className="input toolbar-search"
            placeholder="搜索手机 / 昵称"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
        </div>
        <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} loading={loading} />
      </div>
    </div>
  );
}
