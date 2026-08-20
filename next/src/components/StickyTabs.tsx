'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 订单列表顶部的吸顶状态筛选 Tab：
// - sticky 吸在 PageNav（48px 高）下方，滚动时保持可见；
// - 支持数量角标（如「待上门 3」），为 0 时不显示角标；
// - Tab 超出宽度时可横向滚动，右侧出现渐隐遮罩 + 箭头指引，
//   滚动到底后指引自动消失；点击箭头向右滑一屏。
export interface StickyTabItem {
  key: string;
  label: string;
  count?: number;
}

export default function StickyTabs({
  tabs,
  active,
  onChange,
  ariaLabel = '状态筛选',
}: {
  tabs: StickyTabItem[];
  active: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // 检测是否还有未展示的右侧 Tab（留 4px 容差）
  const update = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update, tabs]);

  const scrollRight = () => {
    const el = innerRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className="sticky-tabs">
      <div className="sticky-tabs-wrap">
        <div
          ref={innerRef}
          className="sticky-tabs-inner"
          role="tablist"
          aria-label={ariaLabel}
          onScroll={update}
        >
          {tabs.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`sticky-tab${isActive ? ' active' : ''}`}
                onClick={() => onChange(t.key)}
              >
                {t.label}
                {typeof t.count === 'number' && t.count > 0 && (
                  <span className="sticky-tab-count">{t.count}</span>
                )}
              </button>
            );
          })}
        </div>
        {canScrollRight && (
          <button
            type="button"
            className="sticky-tabs-arrow"
            onClick={scrollRight}
            aria-label="查看更多分类"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
