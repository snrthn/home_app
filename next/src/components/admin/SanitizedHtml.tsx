'use client';

import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

// 富文本只读渲染：本组件只负责「解析 + 净化 + 渲染」，
// 不涉及任何卡片/容器皮肤。排版统一由 globals.css 的 .richtext 基类提供，
// 卡片/容器变体由调用方通过外层标签或 className 决定。
//
// 关键：首屏（SSR 与首次客户端渲染）一律渲染原文，待挂载完成后再用 DOMPurify 清洗。
// 若服务端返回原文、客户端 hydration 时立即清洗，两端 HTML 字符串不同会触发 React
// hydration mismatch（表现为切换路由/刷新时反复报水合错误）。
export default function SanitizedHtml({
  html,
  className,
}: {
  html?: string | null;
  className?: string;
}) {
  const [clean, setClean] = useState(html || '');

  useEffect(() => {
    setClean(
      DOMPurify.sanitize(html || '', {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target', 'rel', 'style'],
      }),
    );
  }, [html]);

  return (
    <div
      className={'richtext' + (className ? ' ' + className : '')}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
