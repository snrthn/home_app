'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// 统一的列表行入口：左图标 + 标题 + 右侧值/箭头。可用于设置项、协议入口等。
export default function Cell({
  label,
  value,
  href,
  onClick,
  icon,
  trailing = 'chevron',
  danger,
}: {
  label: ReactNode;
  value?: ReactNode;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  trailing?: 'chevron' | 'none' | ReactNode;
  danger?: boolean;
}) {
  const inner = (
    <>
      {icon && <span className="cell-icon">{icon}</span>}
      <span className="cell-label">{label}</span>
      {value !== undefined && <span className="cell-value">{value}</span>}
      <span className="cell-trailing">
        {trailing === 'chevron' ? <ChevronRight /> : trailing === 'none' ? null : trailing}
      </span>
    </>
  );

  const cls = `cell${danger ? ' cell-danger' : ''}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}
