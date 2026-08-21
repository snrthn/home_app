import { NextRequest, NextResponse } from 'next/server';
import { PUBLIC_ROUTES, ROLE_HOME, roleFromPathname } from './lib/route-guards';
import { findMenuPerm } from './lib/admin-menu';

// 解码 JWT 第二段（payload）：Edge runtime 内置 atob，无需 Node 依赖。
// 返回完整 claims（role / perms / staffRoleKey），供角色校验与 RBAC 细粒度校验共用。
// 注意：此处仅解码不验证签名（签名由后端校验）；middleware 只做粗粒度路由引导。
function decodeToken(token: string): {
  role?: string;
  perms?: string[];
  staffRoleKey?: string | null;
} | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = JSON.parse(
      decodeURIComponent(
        atob(part.replace(/-/g, '+').replace(/_/g, '/')),
      ),
    );
    return json;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) 公共白名单：登录前可访问，直接放行
  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/'),
  );
  if (isPublic) return NextResponse.next();

  // 2) 不在任何角色前缀下（如根 /、favicon 等；_next 已由 matcher 排除）：放行交页面处理
  const role = roleFromPathname(pathname);
  if (!role) return NextResponse.next();

  // 3) 读取 cookie 中的多角色 token 映射（setSession 时按角色写入）
  const raw = req.cookies.get('lm_tokens')?.value;
  let map: Record<string, string> = {};
  if (raw) {
    try {
      map = JSON.parse(raw) as Record<string, string>;
    } catch {
      map = {};
    }
  }
  const token = map[role];

  // 4) 未登录（无该角色 token）：重定向到登录页
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 5) 已登录但 token 角色与当前路径角色不符（串号/越权）：回跳本角色首页
  const claims = decodeToken(token);
  const tokenRole = claims?.role;
  if (tokenRole && tokenRole !== role) {
    const home = ROLE_HOME[tokenRole as keyof typeof ROLE_HOME] ?? '/login';
    return NextResponse.redirect(new URL(home, req.url));
  }

  // 6) 管理端 RBAC 细粒度校验：已登录的 admin，访问受限路由但无对应权限 → 跳无权限页。
  //    super_admin 放行全部；其余按 JWT 内 perms 集合判定（与后端 @RequirePerm 同源）。
  //    findMenuPerm 对“无 perm 约束”的路由（工作台/个人中心/目录）返回 null，直接放行。
  //    /admin/no-permission 自身不在 ADMIN_MENU，返回 null → 不会被二次拦截，无重定向循环。
  if (role === 'admin') {
    const required = findMenuPerm(pathname);
    if (required) {
      const isSuper = claims?.staffRoleKey === 'super_admin';
      const hasPerm = (claims?.perms ?? []).includes(required);
      if (!isSuper && !hasPerm) {
        const url = req.nextUrl.clone();
        url.pathname = '/admin/no-permission';
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  // 仅拦截三个角色区与登录页；_next/static 等静态资源由 Next 自动排除
  matcher: [
    '/client/:path*',
    '/master/:path*',
    '/admin/:path*',
    '/login/:path*',
    '/forgot-password/:path*',
  ],
};
