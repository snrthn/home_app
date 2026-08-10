'use client';

import { TextareaHTMLAttributes } from 'react';

// 多行文本输入：复用 .input 令牌类保持与单行输入框一致的边框/圆角/焦点态，
// 额外锁定纵向拉伸与最小高度，避免用户横向拖拽把表单撑变形。
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, style, rows = 4, ...rest } = props;
  return (
    <textarea
      rows={rows}
      className={`input textarea ${className ?? ''}`}
      style={{ resize: 'vertical', minHeight: 88, ...style }}
      {...rest}
    />
  );
}
