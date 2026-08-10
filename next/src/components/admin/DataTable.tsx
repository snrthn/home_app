'use client';

import { ReactNode } from 'react';

export type StatusTone = 'green' | 'orange' | 'red' | 'gray' | 'blue';

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}

export interface Column<T> {
  key: string;
  title: string;
  render?: (row: T) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyText?: string;
}

// 轻量泛型表格：列配置 + 行渲染 + 加载/空态。四个管理端列表页共用。
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyText = '暂无数据',
}: DataTableProps<T>) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width, textAlign: c.align || 'left' }}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || 'left' }}>
                  {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <div className="data-loading">加载中…</div>}
      {!loading && rows.length === 0 && <div className="data-empty">{emptyText}</div>}
    </div>
  );
}
