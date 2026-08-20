'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getPerformanceReport,
  type PerformanceReport,
} from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { BarChart } from '@/components/admin/ReportCharts';
import DateRangeFilter, { type DateRange } from '@/components/admin/DateRangeFilter';

const SORTS = [
  { key: 'revenue', label: '收入' },
  { key: 'orders', label: '接单量' },
  { key: 'rating', label: '评分' },
  { key: 'completion', label: '完成率' },
] as const;

const fmtMoney = (n: number) =>
  `¥${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// 师傅绩效：接单量 / 完成率 / 评分 / 收入排行（默认历史累计，按收入排序）
export default function PerformanceReportPage() {
  useCurrentUser('admin');
  const [sort, setSort] = useState<string>('revenue');
  const [range, setRange] = useState<DateRange>({});

  const { data, isLoading } = useQuery<PerformanceReport>({
    queryKey: [...QK.reportPerformance, sort, range.start ?? '', range.end ?? ''],
    queryFn: () =>
      getPerformanceReport({ sort, limit: 50, start: range.start, end: range.end }),
  });

  const rows = data?.list ?? [];

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>师傅绩效</h1>
      <p style={{ color: 'var(--color-text-soft)', margin: '2px 0 12px' }}>
        默认历史累计口径。评分取真实评价均值（未评价师傅不计分）；收入 = 已入账结算（含补偿单）。
      </p>

      <div className="report-filters">
        <div className="dim-tabs">
          {SORTS.map((s) => (
            <button
              key={s.key}
              className={`dim-tab${sort === s.key ? ' active' : ''}`}
              onClick={() => setSort(s.key)}
            >
              按{s.label}
            </button>
          ))}
        </div>
        <DateRangeFilter onChange={setRange} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>
          收入 Top {Math.min(rows.length, 10)}（{isLoading ? '加载中' : `共 ${data?.total ?? 0} 位师傅`}）
        </h2>
        {isLoading ? (
          <p style={{ color: 'var(--color-text-soft)' }}>加载中…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--color-text-soft)' }}>暂无数据</p>
        ) : (
          <BarChart
            labels={rows.slice(0, 10).map((r) => r.realName)}
            series={[
              {
                name: '收入',
                color: 'var(--color-primary, #4f8cff)',
                values: rows.slice(0, 10).map((r) => r.revenue),
              },
            ]}
          />
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 8 }}>排行明细</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>师傅</th>
              <th>城市</th>
              <th>接单量</th>
              <th>完成量</th>
              <th>取消</th>
              <th>完成率</th>
              <th>评分</th>
              <th>评价数</th>
              <th>收入</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.masterId}>
                <td>{i + 1}</td>
                <td>{r.realName}</td>
                <td>{r.city || '—'}</td>
                <td>{r.orders}</td>
                <td>{r.done}</td>
                <td>{r.cancelled}</td>
                <td>{r.completionRate}%</td>
                <td>{r.rating != null ? r.rating.toFixed(1) : '—'}</td>
                <td>{r.reviewCount}</td>
                <td>{fmtMoney(r.revenue)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: 'var(--color-text-soft)' }}>
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
