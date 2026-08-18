'use client';

import type { ReactNode } from 'react';

// 空数据占位卡片内容：统一「无上间距 + 文本居中」。
// 既用于修复历史手写空块，也作为后续所有空态的唯一写法（见前端 UI 规矩 8）。
// 置于 .card / .about-empty 等容器内，或单独作为占位块均可。
export default function EmptyState({
  text,
  children,
}: {
  text?: string;
  children?: ReactNode;
}) {
  return <div className="empty-state">{text ?? children}</div>;
}
