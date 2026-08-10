'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMasters, type MasterUser } from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import DataTable, { StatusBadge, type Column } from '@/components/admin/DataTable';
import { formatDateTime } from '@/lib/format';

const statusText: Record<string, { t: string; tone: 'green' | 'orange' | 'gray' | 'red' }> = {
  pending: { t: '待审核', tone: 'orange' },
  active: { t: '正常', tone: 'green' },
  disabled: { t: '禁用', tone: 'gray' },
};

const skillsText = (s?: unknown) => {
  if (!s) return '-';
  if (Array.isArray(s)) return s.join(' / ');
  if (typeof s === 'string') return s;
  try {
    return JSON.stringify(s);
  } catch {
    return '-';
  }
};

export default function MasterListPage() {
  // react-query 取数：同一 queryKey 的在途请求会被合并，避免初始化重复请求。
  const { data: rows = [], isLoading: loading } = useQuery<MasterUser[]>({
    queryKey: QK.adminMasters,
    queryFn: () => getMasters(),
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

  const columns: Column<MasterUser>[] = [
    { key: 'realName', title: '姓名', render: (r) => r.realName || '-' },
    { key: 'phone', title: '手机号', render: (r) => r.user?.phone || '-' },
    { key: 'city', title: '服务城市', render: (r) => r.city || '-' },
    { key: 'skills', title: '技能', render: (r) => skillsText(r.skills) },
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
        <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} loading={loading} />
      </div>
    </div>
  );
}
