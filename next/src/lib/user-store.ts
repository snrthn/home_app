'use client';

import { create } from 'zustand';
import type { AppRole, UserInfo } from './auth';

interface UserState {
  // 按角色保存的用户信息（与 token 同构，支持三端在同一浏览器共存）
  users: Partial<Record<AppRole, UserInfo>>;
  setUser: (role: AppRole, info: UserInfo) => void;
  clearUser: (role?: AppRole) => void;
  getUser: (role: AppRole) => UserInfo | undefined;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: {},
  setUser: (role, info) =>
    set((s) => ({ users: { ...s.users, [role]: info } })),
  clearUser: (role) =>
    set((s) => {
      if (role) {
        const next = { ...s.users };
        delete next[role];
        return { users: next };
      }
      return { users: {} };
    }),
  getUser: (role) => get().users[role],
}));
