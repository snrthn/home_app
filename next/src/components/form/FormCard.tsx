'use client';

import { ReactNode } from 'react';

// 表单分区卡片，统一 .card 视觉
export function FormCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="card form-card">
      {title && <h3 className="form-card-title">{title}</h3>}
      {children}
    </div>
  );
}
