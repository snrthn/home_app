import { NextRequest, NextResponse } from 'next/server';
import { PUBLIC_ROUTES, ROLE_HOME, roleFromPathname } from './lib/route-guards';

// 从 JWT 第二段（payload）解出 role。浏览器/Edge runtime 均内置 atob，无需 Node 依赖。
function roleFromToken(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = JSON.parse(
      decodeURIComponent(
        atob(part.replace(/-/g, '+').replace(/_/g, '/')),
      ),
    );
    return json.role ?? null;
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
  const tokenRole = roleFromToken(token);
  if (tokenRole && tokenRole !== role) {
    const home = ROLE_HOME[tokenRole as keyof typeof ROLE_HOME] ?? '/login';
    return NextResponse.redirect(new URL(home, req.url));
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
  ],
};
