'use client';

import { useCallback, useRef, useState } from 'react';

// 轻量报表图表组件（纯 SVG，无第三方依赖）。
// viewBox 1000×200（5:1 宽高比），在典型管理后台内容宽度下接近 1:1 渲染，
// 避免缩放导致图内文字与页面其他元素比例失调。
// 图例在 SVG 外用 HTML 渲染，字号不受 viewBox 缩放影响。
// Tooltip 为自定义 HTML 浮层（类 ECharts 风格）：深色圆角面板 + 系列色点 + axisPointer 竖线。

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

const TEXT_SOFT = 'var(--color-text-soft, #888)';
const GRID = 'var(--color-border, #e5e7eb)';
const VIEW_W = 1000;

const PAD_L = 48;
const PAD_R = 14;
const PAD_T = 10;
const PAD_B = 24;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const unit = v / pow;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10;
  return nice * pow;
}

function fmtAxis(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}w`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

/** 图例 HTML（在 SVG 外，不受 viewBox 缩放影响） */
function Legend({ series }: { series: ChartSeries[] }) {
  if (series.length <= 1) return null;
  return (
    <div className="chart-legend">
      {series.map((s, i) => (
        <span key={i} className="chart-legend-item">
          <span className="chart-legend-dot" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

interface TipState {
  idx: number;
  left: number;
  top: number;
}

/**
 * 共享 hover 状态：在容器 div 上监听 mousemove，
 * 将鼠标的屏幕坐标换算成 viewBox 坐标（svgX），
 * 再经 xToIdx 得到最近的数据点索引，同时计算 tooltip 面板的定位（避免溢出容器）。
 */
function useChartTip(n: number, xToIdx: (svgX: number) => number) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const svgX = (x / rect.width) * VIEW_W;
      const idx = xToIdx(svgX);
      if (idx < 0 || idx >= n) {
        setTip(null);
        return;
      }
      // 面板估算尺寸，超界时翻转方向
      const PANEL_W = 200;
      const PANEL_H = 96;
      let left = x + 14;
      if (left + PANEL_W > rect.width - 8) left = x - 14 - PANEL_W;
      left = Math.max(8, left);
      let top = y + 14;
      if (top + PANEL_H > rect.height - 8) top = y - 14 - PANEL_H;
      top = Math.max(8, top);
      setTip({ idx, left, top });
    },
    [n, xToIdx],
  );

  const onLeave = useCallback(() => setTip(null), []);

  return { boxRef, tip, onMove, onLeave };
}

/** 类 ECharts tooltip 浮层 */
function ChartTooltip({
  tip,
  labels,
  series,
}: {
  tip: TipState;
  labels: string[];
  series: ChartSeries[];
}) {
  return (
    <div className="chart-tooltip" style={{ left: tip.left, top: tip.top }}>
      <div className="chart-tooltip-title">{labels[tip.idx]}</div>
      {series.map((s, i) => (
        <div key={i} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: s.color }} />
          <span className="chart-tooltip-name">{s.name}</span>
          <span className="chart-tooltip-val">
            {(s.values[tip.idx] ?? 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 分组柱状图：labels 与各 series.values 一一对应 */
export function BarChart({
  labels,
  series,
  height = 200,
}: {
  labels: string[];
  series: ChartSeries[];
  height?: number;
}) {
  const n = labels.length;
  if (n === 0) return <div className="chart-empty">暂无数据</div>;
  const plotW = VIEW_W - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const step = plotW / n;
  const groupW = Math.min(step * 0.68, 36);
  const barW = series.length > 1 ? groupW / series.length - 3 : groupW;
  const gys = [0, 0.25, 0.5, 0.75, 1].map((r) => PAD_T + plotH * (1 - r));
  const labelSkip = Math.ceil(n / 12);
  const xAt = (i: number) => PAD_L + step * i + step / 2;
  const xToIdx = (svgX: number) => Math.round((svgX - PAD_L - step / 2) / step);
  const { boxRef, tip, onMove, onLeave } = useChartTip(n, xToIdx);

  return (
    <div ref={boxRef} className="report-chart-box" onMouseMove={onMove} onMouseLeave={onLeave}>
      <Legend series={series} />
      <svg viewBox={`0 0 ${VIEW_W} ${height}`} className="report-chart" role="img">
        {gys.map((y, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={VIEW_W - PAD_R} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={PAD_L - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill={TEXT_SOFT}>
              {fmtAxis(max * i * 0.25)}
            </text>
          </g>
        ))}
        {labels.map((label, i) => {
          const cx = xAt(i);
          return (
            <g key={i}>
              {series.map((s, si) => {
                const h = (s.values[i] / max) * plotH;
                const x =
                  cx - groupW / 2 + si * (barW + 3) + (series.length > 1 ? 0 : groupW / 2 - barW / 2);
                return (
                  <rect
                    key={si}
                    x={x}
                    y={PAD_T + plotH - h}
                    width={barW}
                    height={Math.max(h, s.values[i] > 0 ? 1 : 0)}
                    rx={2}
                    fill={s.color}
                  />
                );
              })}
              {(n <= 12 || i % labelSkip === 0 || i === n - 1) && (
                <text x={cx} y={height - 8} textAnchor="middle" fontSize={9} fill={TEXT_SOFT}>
                  {label}
                </text>
              )}
            </g>
          );
        })}
        {tip && (
          <line
            x1={xAt(tip.idx)}
            x2={xAt(tip.idx)}
            y1={PAD_T}
            y2={height - PAD_B}
            stroke={TEXT_SOFT}
            strokeOpacity={0.55}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>
      {tip && <ChartTooltip tip={tip} labels={labels} series={series} />}
    </div>
  );
}

/** 多系列折线图：labels 与各 series.values 一一对应 */
export function LineChart({
  labels,
  series,
  height = 200,
}: {
  labels: string[];
  series: ChartSeries[];
  height?: number;
}) {
  const n = labels.length;
  if (n === 0) return <div className="chart-empty">暂无数据</div>;
  const plotW = VIEW_W - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const step = plotW / Math.max(n - 1, 1);
  const xAt = (i: number) => PAD_L + step * i;
  const yAt = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const xToIdx = (svgX: number) => Math.round((svgX - PAD_L) / step);
  const gys = [0, 0.25, 0.5, 0.75, 1].map((r) => PAD_T + plotH * (1 - r));
  const labelSkip = Math.ceil(n / 12);
  const { boxRef, tip, onMove, onLeave } = useChartTip(n, xToIdx);

  return (
    <div ref={boxRef} className="report-chart-box" onMouseMove={onMove} onMouseLeave={onLeave}>
      <Legend series={series} />
      <svg viewBox={`0 0 ${VIEW_W} ${height}`} className="report-chart" role="img">
        {gys.map((y, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={VIEW_W - PAD_R} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={PAD_L - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill={TEXT_SOFT}>
              {fmtAxis(max * i * 0.25)}
            </text>
          </g>
        ))}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
          return (
            <g key={si}>
              <polyline
                points={pts}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.values.map((v, i) =>
                v > 0 ? (
                  <circle key={i} cx={xAt(i)} cy={yAt(v)} r={2.5} fill={s.color} />
                ) : null,
              )}
            </g>
          );
        })}
        {labels.map((label, i) =>
          n <= 12 || i % labelSkip === 0 || i === n - 1 ? (
            <text key={i} x={xAt(i)} y={height - 8} textAnchor="middle" fontSize={9} fill={TEXT_SOFT}>
              {label}
            </text>
          ) : null,
        )}
        {tip && (
          <line
            x1={xAt(tip.idx)}
            x2={xAt(tip.idx)}
            y1={PAD_T}
            y2={height - PAD_B}
            stroke={TEXT_SOFT}
            strokeOpacity={0.55}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>
      {tip && <ChartTooltip tip={tip} labels={labels} series={series} />}
    </div>
  );
}
