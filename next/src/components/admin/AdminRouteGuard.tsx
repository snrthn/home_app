'use client';

import { usePathname } from 'next/navigation';
import { useUserStore } from '@/lib/user-store';
import { useAdminPerms } from '@/lib/usePerm';
import { findMenuPerm } from '@/lib/admin-menu';
import NoPermission from './NoPermission';

// 管理端页面级路由守卫（A 方案，客户端兜底）。
// 与 middleware（B 方案）共用 findMenuPerm + 同一套权限语义：
// - 路由无 perm 约束（工作台/个人中心/目录）→ 恒放行；
// - 当前账号为 super_admin 或命中所需权限码 → 放行；
// - 否则渲染统一「无权限」提示页（不再裸奔 403 白屏）。
//
// loading 态：profile（/auth/profile）尚未加载、useUserStore 中 admin 为空时先放行 children，
// 避免「未拿到 perms 误判为无权限」的闪烁；profile 返回后若确无权限会自动重渲染为无权限页。
export default function AdminRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { can } = useAdminPerms();
  const adminUser = useUserStore((s) => s.users.admin);
  const loading = !adminUser;

  if (loading) return <>{children}</>;

  const required = findMenuPerm(pathname);
  if (required && !can(required)) {
    return <NoPermission />;
  }
  return <>{children}</>;
}
