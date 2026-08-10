'use client';

import { SelectHTMLAttributes, ReactNode } from 'react';

// 下拉选择，统一使用 .input 令牌类
export function SelectInput({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children?: ReactNode }) {
  return (
    <select className={`input select-input ${className ?? ''}`} {...rest}>
      {children}
    </select>
  );
}
