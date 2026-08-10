'use client';

import Link from 'next/link';

// 统一的「返回」入口，链接到对应角色首页，风格与 .nav-link 一致。
export function BackLink({
  href,
  label = '返回',
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link href={href} className="back-link">
      <span aria-hidden>←</span> {label}
    </Link>
  );
}
