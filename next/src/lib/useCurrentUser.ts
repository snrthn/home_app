'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api, { logoutApi } from './api';
import { QK } from './query-keys';
import { queryClient } from '@/app/providers';
import {
  getToken,
  clearSession,
  clearUserCache,
  getUserCache,
  setUserCache,
  type AppRole,
  type UserInfo,
} from './auth';
import { useUserStore } from './user-store';

// /auth/profile 的取数函数。统一走 react-query 的 QK.profile：
// 同一个 key 的在途请求会被合并，无论谁先发起（layout 的 CurrentUserLoader、
// 个人中心页自身的 useQuery、还是 React 18 严格模式的第二次挂载），
// 一轮初始化只会真正打一次接口。
export function fetchProfile(): Promise<UserInfo> {
  return api.get('/auth/profile').then((res) => res.data as UserInfo);
}

// 供组件外/命令式场景使用的去重取数（页面初始化用它，而不是裸调 api）。
export function fetchProfileDeduped(role: AppRole): Promise<UserInfo> {
  return queryClient.fetchQuery({
    queryKey: QK.profile(role),
    queryFn: fetchProfile,
  });
}

// 在 portal layout 挂载时调用：
// 1) 若当前角色无 token -> 清本地并跳登录
// 2) 先用 localStorage 缓存瞬时展示（避免白屏）
// 3) 调 /auth/profile 重新查询，以接口数据为准刷新 store 与缓存
// 刷新页面会因 store / react-query 缓存丢失而重新走第 3 步（满足"刷新重新查询"）。
export function useCurrentUser(role: AppRole) {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const clearUser = useUserStore((s) => s.clearUser);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      clearSession(role);
      clearUser(role);
      clearUserCache(role);
      router.replace('/login');
      return;
    }

    // 先用缓存瞬时展示（避免白屏/闪烁）
    const cached = getUserCache(role);
    if (cached) setUser(role, cached);

    fetchProfileDeduped(role)
      .then((info) => {
        setUserCache(role, info); // 按角色分 key 持久化
        setUser(role, info);
      })
      .catch(() => {
        // 拉取失败（多为 token 失效 / cookie 损坏 / localStorage 串号）：主动清掉后端
        // HttpOnly 的 lm_tokens cookie（前端删不了，只能走 /auth/logout），自愈脏状态，
        // 避免带着坏 cookie 反复重定向回登录页、profile 永远不被有效触发。
        logoutApi().catch(() => {});
        clearSession(role);
        clearUser(role);
        clearUserCache(role);
        router.replace('/login');
      });
  }, [role, router, setUser, clearUser]);
}
