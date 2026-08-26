import type { AppRole } from './auth';

// ============ 路由白名单（集中维护 · 前端代码配置）============
// 说明：此文件是路由守卫的唯一配置源，改白名单只改这里，无需动 middleware。

// 1) 公共白名单：登录前即可访问的路由（无需 token）。
//    新增"登录前可访问"的页面（如找回密码）在此追加即可。
export const PUBLIC_ROUTES: string[] = ['/login', '/forgot-password', '/install'];

// 2) 各角色允许访问的路由前缀白名单。
//    客户只能进 /client*，师傅只能进 /master*，管理员只能进 /admin*，
//    跨前缀访问一律在 middleware 层拦截。要细粒度放行某子路由，在此展开数组即可。
export const ROLE_PREFIXES: Record<AppRole, string> = {
  customer: '/client',
  master: '/master',
  admin: '/admin',
};

// 3) 各角色首页：未登录 / 越权重定向的落点。
export const ROLE_HOME: Record<AppRole, string> = {
  customer: '/client',
  master: '/master',
  admin: '/admin',
};

// 根据路径推导所属角色（服务端 middleware 也可用，无 window 依赖）。
export function roleFromPathname(pathname: string): AppRole | null {
  if (pathname.startsWith('/client')) return 'customer';
  if (pathname.startsWith('/master')) return 'master';
  if (pathname.startsWith('/admin')) return 'admin';
  return null;
}
