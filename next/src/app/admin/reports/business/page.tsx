'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getBusinessReport,
  type BusinessReport,
  type ReportDimension,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { BarChart } from '@/components/admin/ReportCharts';
import DateRangeFilter, { type DateRange } from '@/components/admin/DateRangeFilter';

const DIMS: { key: ReportDimension; label: string }[] = [
  { key: 'day', label: '按日' },
  { key: 'week', label: '按周' },
  { key: 'month', label: '按月' },
];

const fmtMoney = (n: number) =>
  `¥${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// 经营报表：订单量 / 营收 / 退款 / 完成率，按日周月维度
export default function BusinessReportPage() {
  useCurrentUser('admin');
  const [dim, setDim] = useState<ReportDimension>('day');
  const [range, setRange] = useState<DateRange>({});

  const { data, isLoading } = useQuery<BusinessReport>({
    queryKey: [...QK.reportBusiness, dim, range.start ?? '', range.end ?? ''],
    queryFn: () =>
      getBusinessReport({ dimension: dim, start: range.start, end: range.end }),
  });

  const s = data?.summary;
  const stats = [
    { label: '订单量（已支付）', value: s ? s.totalOrders.toLocaleString() : '—' },
    { label: '营收 GMV', value: s ? fmtMoney(s.totalGMV) : '—' },
    { label: '退款金额', value: s ? fmtMoney(s.totalRefundAmount) : '—' },
    { label: '完成率', value: s ? `${s.overallCompletionRate}%` : '—' },
  ];

  const labels = (data?.series ?? []).map((p) => p.date);
  const gmvSeries = {
    name: '营收',
    color: 'var(--color-primary, #4f8cff)',
    values: (data?.series ?? []).map((p) => p.gmv),
  };
  const orderSeries = {
    name: '订单量',
    color: 'var(--color-success, #22c55e)',
    values: (data?.series ?? []).map((p) => p.orders),
  };

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>经营报表</h1>
      <p style={{ color: 'var(--color-text-soft)', margin: '2px 0 12px' }}>
        营收按支付时间统计；退款金额由补偿结算单反推；完成率 =（验收+评价）/ 创建订单。
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
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>营收与订单量趋势</h2>
        {isLoading ? (
          <p style={{ color: 'var(--color-text-soft)' }}>加载中…</p>
        ) : (
          <BarChart labels={labels} series={[gmvSeries, orderSeries]} />
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>明细</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>订单量</th>
              <th>营收</th>
              <th>退款单数</th>
              <th>退款金额</th>
              <th>创建订单</th>
              <th>完成订单</th>
              <th>完成率</th>
            </tr>
          </thead>
          <tbody>
            {(data?.series ?? []).map((p) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td>{p.orders}</td>
                <td>{fmtMoney(p.gmv)}</td>
                <td>{p.refundOrders}</td>
                <td>{fmtMoney(p.refundAmount)}</td>
                <td>{p.createdOrders}</td>
                <td>{p.doneOrders}</td>
                <td>{p.completionRate}%</td>
              </tr>
            ))}
            {(data?.series ?? []).length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-soft)' }}>
                  范围内暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
