'use client';

import { InputHTMLAttributes } from 'react';

// 文本输入，统一使用 .input 令牌类，保证与全局输入框视觉一致
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={`input ${className ?? ''}`} {...rest} />;
}
