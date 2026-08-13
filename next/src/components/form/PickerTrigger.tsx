'use client';

import { ReactNode } from 'react';

/**
 * 弹窗化选择器的字段头：范围 Label 与「添加 / 设置」按钮同一行、按钮右对齐，
 * 比「Label 独占一行 + 按钮另起一行」更省纵向空间。
 * 子节点放已选 chips 与弹窗本体（<PickerModal />）。
 */
export function PickerTrigger({
  label,
  required,
  hint,
  buttonText,
  onOpen,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  buttonText: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <div className="field-label-row">
        <label className="field-label">
          {label}
          {required && <span style={{ color: 'var(--color-primary)' }}> *</span>}
        </label>
        <button type="button" className="btn-primary btn-sm" onClick={onOpen}>
          {buttonText}
        </button>
      </div>
      {hint && <p className="field-hint">{hint}</p>}
      {children}
    </div>
  );
}
