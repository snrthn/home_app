'use client';

import { useState, type MouseEvent } from 'react';
import { useToast } from '@/components/Toast';

interface CopyButtonProps {
  value: string;
  title?: string;
  className?: string;
}

/** 降级方案：非安全上下文（非 https/localhost）时用临时 textarea + execCommand 复制 */
function fallbackCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

/**
 * 一键复制按钮（复制图标）。
 * - 点击即复制传入的 value，并 toast 反馈；
 * - 关键：onClick 中 stopPropagation + preventDefault，避免点击图标时误触发父级行的跳转/点击；
 * - 复制成功后图标短暂变为绿色对勾。
 */
export function CopyButton({ value, title = '复制', className }: CopyButtonProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        fallbackCopy(value);
      }
      setCopied(true);
      toast.success('已复制');
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  return (
    <button
      type="button"
      className={`copy-btn${className ? ` ${className}` : ''}`}
      onClick={handleCopy}
      title={title}
      aria-label={title}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}
