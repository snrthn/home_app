'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import type { AppRole } from '../lib/auth';
import CurrentUserLoader from './CurrentUserLoader';
import PortalTabBar from './PortalTabBar';
import PageNav, { type PageNavMenuItem } from './PageNav';

export interface PortalNavConfig {
  title: string;
  showBack?: boolean;
  backHref?: string;
  onBack?: () => void;
  menu?: PageNavMenuItem[];
}

const DEFAULT_NAV: Record<AppRole, PortalNavConfig> = {
  customer: { title: '老马家电' },
  master: { title: '老马家电 · 师傅端' },
  admin: { title: '管理端' },
};

type NavCtx = {
  config: PortalNavConfig;
  setConfig: (c: PortalNavConfig) => void;
};

const PortalNavContext = createContext<NavCtx | null>(null);

/**
 * 供 client 组件设置公共 Header 配置（页面级使用）。
 * 用内容字段做依赖，避免每次渲染传入新对象引用导致无限 setConfig。
 */
export function usePortalNav(config: PortalNavConfig) {
  const ctx = useContext(PortalNavContext);
  const key = JSON.stringify({
    title: config.title,
    showBack: config.showBack,
    backHref: config.backHref,
    menu: config.menu,
  });
  useEffect(() => {
    if (!ctx) return;
    ctx.setConfig({ ...config });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * 供 server 组件使用：把 Header 配置上抛给布局层，自身不渲染任何 DOM。
 * 页面只需声明 title/showBack/backHref/menu，真正的 <PageNav> 由 PortalShell 在布局层渲染。
 */
export function PortalNavSetter(props: PortalNavConfig) {
  usePortalNav(props);
  return null;
}

// 用户端 / 师傅端统一外壳：全局注入当前用户 + 公共顶栏 + 内容容器 + 底部 Tab。
// 顶栏（PageNav）作为公共区域在布局层渲染，由各页通过 PortalNavSetter 上抛标题/返回/菜单，
// 因此不再嵌在页面内容容器（portal-main）内——既符合"Header 属公共区域"的语义，
// 也避免 sticky 顶栏落在每次路由切换会重新挂载的页面容器内，从而消除
// Next.js "Skipping auto-scroll behavior" 的滚动恢复警告。
// 管理端为桌面侧栏形态，不使用本外壳（见 app/admin/layout.tsx）。
export default function PortalShell({
  role,
  children,
}: {
  role: AppRole;
  children: ReactNode;
}) {
  const [config, setConfig] = useState<PortalNavConfig>(DEFAULT_NAV[role]);

  return (
    <PortalNavContext.Provider value={{ config, setConfig }}>
      <CurrentUserLoader role={role} />
      <PageNav {...config} />
      <main className="portal-main">{children}</main>
      <PortalTabBar role={role} />
    </PortalNavContext.Provider>
  );
}
