'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '../lib/auth';

interface Tab {
  key: string;
  label: string;
  href: string;
  icon: 'home' | 'notice' | 'me' | 'orders';
}

const TABS: Record<AppRole, Tab[]> = {
  customer: [
    { key: 'home', label: '首页', href: '/client', icon: 'home' },
    { key: 'orders', label: '订单', href: '/client/orders', icon: 'orders' },
    { key: 'notice', label: '公告', href: '/client/notices', icon: 'notice' },
    { key: 'me', label: '我的', href: '/client/me', icon: 'me' },
  ],
  master: [
    { key: 'home', label: '首页', href: '/master', icon: 'home' },
    { key: 'orders', label: '接单', href: '/master/orders/pool', icon: 'orders' },
    { key: 'notice', label: '公告', href: '/master/notices', icon: 'notice' },
    { key: 'me', label: '我的', href: '/master/me', icon: 'me' },
  ],
  admin: [],
};

const ICONS: Record<Tab['icon'], JSX.Element> = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
    </>
  ),
  notice: (
    <>
      <path d="M12 3a5 5 0 0 0-5 5v4l-2 3h14l-2-3V8a5 5 0 0 0-5-5Z" />
      <path d="M10.5 19a1.5 1.5 0 0 0 3 0" />
    </>
  ),
  me: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  orders: (
    <>
      <path d="M6 2h12a1 1 0 0 1 1 1v18l-3-2-3 2-3-2-3 2V3a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
};

// 用户端 / 师傅端底部 Tab 导航（移动端形态）。admin 不使用。
// 仅在三个主 Tab 页（pathname 精确匹配）显示；其余页面（如公告详情、关于我们、修改资料）
// 只保留 HeaderBar，不展示底部 Tab，避免非主流程页面出现多余的导航条。
export default function PortalTabBar({ role }: { role: AppRole }) {
  const tabs = TABS[role];
  const pathname = usePathname();
  if (!tabs.length) return null;
  const isTabPage = tabs.some((t) => t.href === pathname);
  if (!isTabPage) return null;

  return (
    <nav className="portal-tabbar" aria-label="主导航">
      <div className="portal-tabbar-inner">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`portal-tab${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[tab.icon]}
              </svg>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
