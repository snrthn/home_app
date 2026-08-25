'use client';

import { ReactNode, createContext, useContext, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGlobalConfig } from '@/lib/api';
import { QK } from '@/lib/query-keys';
import { applyThemeColor } from '@/lib/theme';

export interface GlobalConfigValue {
  siteName: string;
  logoUrl: string; // 相对（/uploads/...）或绝对（https://...）地址
  primaryColor: string;
  sentryDsn: string | null; // Sentry DSN，有值则前端初始化错误监控
  isLoading: boolean;
}

const GlobalConfigCtx = createContext<GlobalConfigValue | null>(null);

/**
 * 全局配置提供器：挂载时拉取一次（react-query 按 queryKey 去重，全端共享同一份），
 * 并通过 applyThemeColor 把主题色应用到 :root CSS 变量。
 * 各端（用户端 / 师傅端 / 运营端）从这里读取系统名称与 Logo，实现配置驱动的品牌一致。
 */
export function GlobalConfigProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: QK.globalConfig,
    queryFn: getGlobalConfig,
    staleTime: 5 * 60 * 1000,
  });

  const siteName = data?.siteName ?? '';
  const logoUrl = data?.logoUrl ?? '';
  const primaryColor = data?.primaryColor ?? '';
  const sentryDsn = data?.sentryDsn ?? null;

  useEffect(() => {
    applyThemeColor(primaryColor || null);
  }, [primaryColor]);

  return (
    <GlobalConfigCtx.Provider
      value={{ siteName, logoUrl, primaryColor, sentryDsn, isLoading }}
      >
        {children}
      </GlobalConfigCtx.Provider>
  );
}

export function useGlobalConfig(): GlobalConfigValue {
  const ctx = useContext(GlobalConfigCtx);
  if (!ctx) {
    // 兜底：未包在 Provider 内（理论上不会触发）时返回默认值，避免崩溃
    return { siteName: '', logoUrl: '', primaryColor: '', sentryDsn: null, isLoading: false };
  }
  return ctx;
}
