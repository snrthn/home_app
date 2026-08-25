'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/Toast';
import { GlobalConfigProvider } from '@/lib/global-config';
import { SentryProvider } from '@/components/SentryProvider';

// 模块级单例：供 api.ts 的 401 拦截器在组件外调用（如 queryClient.clear()）。
// 仅客户端使用，react-query 缓存为瞬态客户端状态，不存在 SSR 跨请求串数据问题。
//
// 默认项说明（页面初始化「接口被请求两次」的统一解法）：
// - React 18 严格模式(dev) 会把组件挂→卸→挂一遍，裸 useEffect 取数必然发两次请求。
//   react-query 按 queryKey 对「在途请求」去重：第二次挂载复用同一个 Promise，
//   因此无论 dev/prod，同一 key 每轮初始化只会真正发出一次请求。
// - staleTime 保持 0：进入页面/刷新仍以最新数据为准，只去掉重复，不引入缓存陈旧。
// - refetchOnWindowFocus 关掉：切回浏览器标签页不再静默重发一轮请求。
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalConfigProvider>
        <SentryProvider>
          <ToastProvider>{children}</ToastProvider>
        </SentryProvider>
      </GlobalConfigProvider>
    </QueryClientProvider>
  );
}
