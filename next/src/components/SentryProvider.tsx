'use client';

import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useGlobalConfig } from '@/lib/global-config';
import { initSentry, closeSentry } from '@/lib/sentry';
import { getToken } from '@/lib/auth';

/**
 * Sentry 前端错误监控初始化器：
 * 1. 从 GlobalConfig 读取 sentryDsn，有值则 initSentry，无值则 closeSentry（兜底初始化）
 * 2. 登录态下建立 WS 连接，监听 sentry:config 事件——运营平台变更后在线用户立即生效
 *
 * 开关只影响前端监控，后端日志常开启（Pino + PM2）。
 */
export function SentryProvider({ children }: { children: React.ReactNode }) {
  const { sentryDsn } = useGlobalConfig();

  useEffect(() => {
    if (sentryDsn) {
      initSentry(sentryDsn);
    } else {
      closeSentry();
    }
  }, [sentryDsn]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = getToken();
    if (!token) return;

    const wsBase = process.env.NEXT_PUBLIC_API_BASE
      ? window.location.origin
      : `http://${window.location.hostname}:3721`;

    const socket: Socket = io(wsBase, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      auth: { token },
    });

    socket.on('sentry:config', (data: { dsn?: string }) => {
      if (data?.dsn) {
        initSentry(data.dsn);
      } else {
        closeSentry();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return <>{children}</>;
}
