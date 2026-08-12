'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

// 通用 404 视图：同时适配管理端（桌面）与 portal 端（移动端）。
// 各入口 not-found.tsx 负责把它放进对应的 layout 并设置导航。
export default function NotFoundView({
  role = 'portal',
  code = '404',
  title = '页面走丢了',
  subtitle = '你访问的页面不存在或已被移除',
  homeHref,
  homeLabel = '返回首页',
  showBack = false,
  backHref,
}: {
  role?: 'admin' | 'portal';
  code?: string;
  title?: string;
  subtitle?: string;
  homeHref: string;
  homeLabel?: string;
  showBack?: boolean;
  backHref?: string;
}) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) return;
    router.back();
  };

  const isAdmin = role === 'admin';

  return (
    <div
      style={{
        minHeight: isAdmin ? '60vh' : 'calc(100vh - 160px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isAdmin ? 24 : '48px 24px',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: isAdmin ? 440 : 360,
          width: '100%',
          textAlign: 'center',
          padding: isAdmin ? 40 : 32,
        }}
      >
        {/* 404 图标：一个缺角的文档 / 放大镜组合 */}
        <svg
          width={isAdmin ? 72 : 64}
          height={isAdmin ? 72 : 64}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-primary, #3E8FB0)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginBottom: 20, opacity: 0.9 }}
          aria-hidden
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="15" x2="15" y2="15" />
          <circle cx="17" cy="17" r="3" />
          <line x1="19.5" y1="19.5" x2="22" y2="22" />
        </svg>

        <div
          style={{
            fontSize: isAdmin ? 48 : 40,
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--color-primary-text, #3E5A6B)',
            marginBottom: 10,
            letterSpacing: '-0.02em',
          }}
        >
          {code}
        </div>

        <h2
          style={{
            margin: '0 0 8px',
            fontSize: isAdmin ? 20 : 18,
            color: 'var(--color-text, #1F2329)',
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin: '0 0 24px',
            color: 'var(--color-text-soft, #6B7280)',
            lineHeight: 1.6,
            fontSize: 14,
          }}
        >
          {subtitle}
        </p>

        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {showBack && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleBack}
              style={{ minWidth: 100 }}
            >
              返回上一页
            </button>
          )}
          <Link
            href={homeHref}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 120,
            }}
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
