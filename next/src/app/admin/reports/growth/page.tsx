'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getGrowthReport,
  type GrowthReport,
  type ReportDimension,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { LineChart } from '@/components/admin/ReportCharts';
import DateRangeFilter, { type DateRange } from '@/components/admin/DateRangeFilter';

const DIMS: { key: ReportDimension; label: string }[] = [
  { key: 'day', label: '按日' },
  { key: 'week', label: '按周' },
  { key: 'month', label: '按月' },
];

// 用户增长：新增客户 / 师傅 / 订单趋势 + 注册转化漏斗
export default function GrowthReportPage() {
  useCurrentUser('admin');
  const [dim, setDim] = useState<ReportDimension>('day');
  const [range, setRange] = useState<DateRange>({});

  const { data, isLoading } = useQuery<GrowthReport>({
    queryKey: [...QK.reportGrowth, dim, range.start ?? '', range.end ?? ''],
    queryFn: () =>
      getGrowthReport({ dimension: dim, start: range.start, end: range.end }),
  });

  const s = data?.summary;
  const stats = [
    { label: '新增客户', value: s ? s.newCustomers.toLocaleString() : '—' },
    { label: '新增师傅', value: s ? s.newMasters.toLocaleString() : '—' },
    { label: '新增订单', value: s ? s.newOrders.toLocaleString() : '—' },
    { label: '注册转化率', value: s ? `${s.conversionRate}%` : '—' },
  ];

  const labels = (data?.series ?? []).map((p) => p.date);
  const lineSeries = [
    {
      name: '客户',
      color: 'var(--color-primary, #4f8cff)',
      values: (data?.series ?? []).map((p) => p.customers),
    },
    {
      name: '师傅',
      color: 'var(--color-warning, #f59e0b)',
      values: (data?.series ?? []).map((p) => p.masters),
    },
    {
      name: '订单',
      color: 'var(--color-success, #22c55e)',
      values: (data?.series ?? []).map((p) => p.orders),
    },
  ];

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>用户增长</h1>
      <p style={{ color: 'var(--color-text-soft)', margin: '2px 0 12px' }}>
        新增按注册/创建时间统计；转化率 = 新客户中产生过订单的比例（累计口径）。
      </p>

      <div className="report-filters">
        <div className="dim-tabs">
          {DIMS.map((d) => (
            <button
              key={d.key}
              className={`dim-tab${dim === d.key ? ' active' : ''}`}
              onClick={() => setDim(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <DateRangeFilter onChange={setRange} />
      </div>

      <div className="stat-grid">
        {stats.map((x) => (
          <div className="card stat-card" key={x.label}>
            <div className="stat-label">{x.label}</div>
            <div className="stat-value">{isLoading ? '加载中' : x.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>新增趋势</h2>
        {isLoading ? (
          <p style={{ color: 'var(--color-text-soft)' }}>加载中…</p>
        ) : (
          <LineChart labels={labels} series={lineSeries} />
        )}
      </div>

      {s && s.newCustomers > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>注册转化漏斗</h2>
          <div className="funnel">
            <div className="funnel-item">
              <div className="funnel-label">新注册客户</div>
              <div className="funnel-bar" style={{ width: '100%', background: 'var(--color-primary, #4f8cff)' }}>
                {s.newCustomers}
              </div>
            </div>
            <div className="funnel-item">
              <div className="funnel-label">已产生订单</div>
              <div className="funnel-bar" style={{ width: `${Math.max(s.conversionRate, 2)}%`, background: 'var(--color-success, #22c55e)' }}>
                {s.convertedCustomers}
              </div>
            </div>
          </div>
          <p style={{ color: 'var(--color-text-soft)', fontSize: 13, marginBottom: 0 }}>
            转化率 {s.conversionRate}%（{s.convertedCustomers} / {s.newCustomers}）
          </p>
        </div>
      )}
    </div>
  );
}
