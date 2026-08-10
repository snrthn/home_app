'use client';
import { useCallback } from 'react';
import api from './api';
import { clearSession, clearUserCache, roleFromPath } from './auth';
import { useUserStore } from './user-store';

// 退出登录：先通知后端拉黑 token，再清本地会话并跳登录页
export function useLogout() {
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
    if (typeof window !== 'undefined') {
      // 管理端退出后回到管理员登录态（mode=admin），其它端回通用登录页。
      const target = role === 'admin' ? '/login?mode=admin&role=customer' : '/login';
      window.location.href = target;
    }
  }, []);
}
