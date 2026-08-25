'use client';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';
import { clearSession, clearUserCache, roleFromPath } from './auth';
import { useUserStore } from './user-store';

// 退出登录：先通知后端拉黑 token，再清本地会话并跳登录页。
// 注意：使用 router.replace 而非 window.location.href，
//       避免整页跳转导致浏览器自动退出全屏（自助终端场景需要保持全屏）。
export function useLogout() {
  const router = useRouter();
  return useCallback(async () => {
    const role = roleFromPath();
    try {
      await api.post('/auth/logout');
    } catch {
      // 后端不可达或 token 已失效也继续退出，不阻塞用户
    }
    if (role) {
      // 只清当前端角色，不影响其它端（与 token 分 key 一致）
      clearSession(role);
      clearUserCache(role);
      useUserStore.getState().clearUser(role);
    } else {
      clearSession();
      clearUserCache();
      useUserStore.getState().clearUser();
    }
    // 管理端退出后回到管理员登录态（mode=admin），其它端回通用登录页。
    const target = role === 'admin' ? '/login?mode=admin&role=customer' : '/login';
    router.replace(target);
  }, [router]);
}
