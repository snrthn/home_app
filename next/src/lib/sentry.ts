import * as Sentry from '@sentry/nextjs';

let isInitialized = false;

/**
 * 初始化 Sentry 前端错误监控。
 * 传入空 DSN 时不初始化（运营平台关闭监控时调用 closeSentry）。
 */
export function initSentry(dsn: string) {
  if (isInitialized || !dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  isInitialized = true;
}

/**
 * 关闭 Sentry 监控，释放 SDK 资源。
 * 运营平台关闭监控后，WS 通知在线用户调用此方法静默关闭。
 */
export function closeSentry() {
  if (!isInitialized) return;
  Sentry.close(2000).then(() => {
    isInitialized = false;
  });
}

export function isSentryInitialized() {
  return isInitialized;
}
