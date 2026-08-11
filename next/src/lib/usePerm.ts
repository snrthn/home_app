'use client';

import { useUserStore } from './user-store';

// 读取当前登录【后台管理员】的 RBAC 权限上下文，供侧边栏/按钮做可见性判断。
// - 超级管理员（staffRoleKey === 'super_admin'）放行全部，等价于拥有所有权限码。
// - 其余账号按 perms 集合匹配；无权限码（未分配角色）则只能看到「无 perm 约束」的项。
//
// 注意：权限以 /auth/profile 返回为准，改角色/权限后需重新登录或刷新页面生效
// （与后端 JWT 中 perms 的语义一致）。
export function useAdminPerms() {
  const user = useUserStore((s) => s.users.admin);
  const isSuperAdmin = user?.staffRoleKey === 'super_admin';
  const permSet = new Set<string>(user?.perms ?? []);

  // 判断某权限码是否可见：未声明 perm 的项恒可见；超级管理员恒可见；否则需命中权限集。
  const can = (perm?: string | null): boolean =>
    !perm || isSuperAdmin || permSet.has(perm);

  return { perms: permSet, isSuperAdmin, can };
}
