'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

// 我的页「功能入口」宫格单元：上图标 + 下文字。支持链接、点击与禁用手势。
export default function MeEntry({
  label,
  href,
  onClick,
  icon,
  disabled,
}: {
  label: ReactNode;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const cls = `me-entry${disabled ? ' is-disabled' : ''}`;
  const inner = (
    <>
      {icon && <span className="me-entry-icon">{icon}</span>}
      <span className="me-entry-label">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}
