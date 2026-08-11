import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMS_KEY, SUPER_ADMIN_KEY } from './perm.decorator';
import { AuthUser } from '../auth/auth-user.interface';

/**
 * 后端权限守卫（真相源）：校验当前登录用户是否持有接口所需权限码。
 * - 未声明 @RequirePerm → 直接放行（仍受 @Roles 入口闸门约束）。
 * - 系统角色 super_admin → 拥有全部权限，直接放行（防锁死）。
 * - 其余用户 → 必须命中所需权限码全集。
 */
@Injectable()
export class PermGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) return false;

    if (user.staffRoleKey === SUPER_ADMIN_KEY) return true;

    const perms: string[] = user.perms ?? [];
    return required.every((code) => perms.includes(code));
  }
}
