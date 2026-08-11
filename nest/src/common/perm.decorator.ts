import { SetMetadata } from '@nestjs/common';

/** 系统角色 key：拥有全部权限，永不锁死 */
export const SUPER_ADMIN_KEY = 'super_admin';

/** 元数据 key：存放接口所需权限码 */
export const PERMS_KEY = 'perms';

/**
 * 声明某个接口/控制器需要的权限码。
 * 配合 PermGuard 使用，默认拒绝（白名单思维）。
 * 例：@RequirePerm('orders:refund')
 */
export const RequirePerm = (...codes: string[]) => SetMetadata(PERMS_KEY, codes);
