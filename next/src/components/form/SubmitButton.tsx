'use client';

import { ButtonHTMLAttributes } from 'react';

// 提交按钮，统一使用 .btn-primary 令牌类
export function SubmitButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, children, ...rest } = props;
  return (
    <button className={`btn-primary ${className ?? ''}`} {...rest}>
      {children}
    </button>
  );
}
