'use client';

import { ReactNode } from 'react';

// 统一表单项容器：标签 + 控件 + 提示/错误，避免各处手搓布局导致风格走形
export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field-label">
        {label}
        {required && (
          <span style={{ color: 'var(--color-primary)' }}> *</span>
        )}
      </label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
