'use client';

import { ReactNode } from 'react';

// 表单分区卡片，统一 .card 视觉
export function FormCard({
  title,
  extra,
  children,
}: {
  title?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card form-card">
      {title && (
        <div className="form-card-title-row">
          <h3 className="form-card-title">{title}</h3>
          {extra}
        </div>
      )}
      {!title && extra}
      {children}
    </div>
  );
}
