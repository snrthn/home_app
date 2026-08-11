'use client';

import Link from 'next/link';

// 统一「无访问权限」提示页。被两处复用：
// 1) 页面级路由守卫（AdminRouteGuard）在客户端判定无权限时渲染；
// 2) /admin/no-permission 路由（B 方案 middleware 重定向落点）。
// 该路由本身不在 ADMIN_MENU，findMenuPerm 返回 null，不会被再次拦截，无重定向循环。
export default function NoPermission() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          padding: 32,
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-primary, #3E8FB0)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginBottom: 16 }}
          aria-hidden
        >
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
        <h2 style={{ margin: '0 0 8px', color: 'var(--color-text, #3E5A6B)' }}>
          无访问权限
        </h2>
        <p
          style={{
            margin: '0 0 20px',
            color: 'var(--color-text-soft, #5B7280)',
            lineHeight: 1.6,
          }}
        >
          您当前的账号没有访问该页面的权限。如需开通，请联系系统管理员分配相应角色。
        </p>
        <Link href="/admin" className="btn-primary" style={{ display: 'inline-block' }}>
          返回工作台
        </Link>
      </div>
    </div>
  );
}
