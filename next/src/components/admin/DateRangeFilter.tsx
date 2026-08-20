'use client';

import { useState } from 'react';

export interface DateRange {
  start?: string; // ISO datetime（YYYY-MM-DDT00:00:00）
  end?: string; // ISO datetime（YYYY-MM-DDT23:59:59）
}

// 数据报表页共用的日期范围筛选。
// 点击「查询」才生效；「清除」恢复默认（不传 start/end，走后端默认范围）。
export default function DateRangeFilter({
  onChange,
}: {
  onChange: (range: DateRange) => void;
}) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const apply = () => {
    if (!start && !end) {
      onChange({});
      return;
    }
    const range: DateRange = {};
    // 带 T00:00:00 / T23:59:59 按本地时区解析，确保含开始/结束整天
    if (start) range.start = `${start}T00:00:00`;
    if (end) range.end = `${end}T23:59:59`;
    onChange(range);
  };

  const clear = () => {
    setStart('');
    setEnd('');
    onChange({});
  };

  return (
    <div className="date-range-filter">
      <input
        className="date-input"
        type="date"
        value={start}
        max={end || undefined}
        onChange={(e) => setStart(e.target.value)}
      />
      <span className="range-sep">至</span>
      <input
        className="date-input"
        type="date"
        value={end}
        min={start || undefined}
        onChange={(e) => setEnd(e.target.value)}
      />
      <button className="filter-btn primary" onClick={apply}>
        查询
      </button>
      <button className="filter-btn" onClick={clear}>
        清除
      </button>
    </div>
  );
}
