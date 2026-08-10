'use client';

import { ReactNode } from 'react';

// 行内表单项：标签在左、内容在右，整行水平两端对齐（space-between）。
// 用于「只读展示型」信息（如审核状态），比 Field 的上下堆叠更紧凑，
// 也便于一眼把「字段名 ↔ 取值」对上。
export function InlineField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field field-inline">
      <div className="field-inline-row">
        <label className="field-label">{label}</label>
        <div className="field-inline-value">{children}</div>
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
