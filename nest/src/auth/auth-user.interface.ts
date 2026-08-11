import { Role } from '@laoma/shared';

/**
 * 经过 JWT 校验后挂在 req.user 上的用户对象。
 * 在共享 JwtPayload 基础上，补充管理端 RBAC 上下文：
 * - staffRoleId / staffRoleKey：内部岗位角色（仅 role=admin 有意义）
 * - perms：该角色拥有的权限码集合（驱动后端 @RequirePerm 守卫）
 */
export interface AuthUser {
  sub: string;
  role: Role;
  phone: string;
  jti?: string;
  exp?: number;
  staffRoleId?: string | null;
  staffRoleKey?: string | null;
  perms: string[];
}
