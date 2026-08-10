'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCustomers, type CustomerUser } from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import DataTable, { StatusBadge, type Column } from '@/components/admin/DataTable';
import { formatDateTime } from '@/lib/format';

const genderText = (g?: string | null) =>
  g === 'male' ? '男' : g === 'female' ? '女' : '未知';

export default function CustomerListPage() {
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
  ];

  return (
    <div>
      <div className="page-head">
        <h2>客户管理</h2>
      </div>
      <div className="card">
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
    </div>
  );
}
