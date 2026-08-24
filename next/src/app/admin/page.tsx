'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboard, type DashboardStats } from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useOrderSocket } from '@/lib/useOrderSocket';

// 管理端首页（工作台）：聚合统计 + 快捷入口。
// 统计数据通过 WS dashboard-refresh 信号实时刷新（订单变化/师傅上线下线即触发）。
export default function AdminHome() {
  useCurrentUser('admin');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: QK.dashboard,
    queryFn: getDashboard,
  });

  // WS 信号驱动刷新：后端在订单状态变化/新单入池/师傅上线下线时
  // emit dashboard-refresh 到 admin-dashboard room，收到后 invalidate query 重拉
  useOrderSocket({
    onDashboardRefresh: () => {
      console.log('[dashboard] WS refresh signal received, invalidating query');
      qc.invalidateQueries({ queryKey: QK.dashboard });
    },
  });

  const fmt = (n: number | undefined) => (n != null ? n.toLocaleString() : '—');
  const fmtMoney = (n: number | undefined) =>
    n != null ? `¥${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  const stats = [
    { label: '今日订单', value: isLoading ? '加载中' : fmt(data?.todayOrders) },
    { label: '待接订单', value: isLoading ? '加载中' : fmt(data?.pendingOrders) },
    { label: '待处理工单', value: isLoading ? '加载中' : fmt(data?.pendingTickets) },
    { label: '在线师傅', value: isLoading ? '加载中' : fmt(data?.onlineMasters) },
    { label: '本月 GMV', value: isLoading ? '加载中' : fmtMoney(data?.monthlyGMV) },
    { label: '平台净收入', value: isLoading ? '加载中' : fmtMoney(data?.monthlyPlatformRevenue) },
  ];
  const quick = [
    { label: '订单管理', path: '/admin/orders/all' },
    { label: '师傅管理', path: '/admin/users/masters' },
    { label: '服务类目', path: '/admin/services/categories' },
    { label: '数据报表', path: '/admin/reports' },
  ];

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>工作台</h1>
      <p style={{ color: 'var(--color-text-soft)', marginTop: -4 }}>
        欢迎回来，这里是管理后台总览。数据实时刷新（订单变化 / 师傅上线即更新）。
      </p>

      <div className="stat-grid">
        {stats.map((s) => (
          <div className="card stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, marginTop: 28, marginBottom: 12 }}>快捷入口</h2>
      <div className="quick-grid">
        {quick.map((q) => (
          <Link key={q.path} href={q.path} className="card quick-card">
            {q.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
