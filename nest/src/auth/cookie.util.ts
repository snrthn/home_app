// 多角色 token 的 cookie 映射（供 Next.js middleware 服务端读取，实现路由前置拦截）。
// 关键点：本 cookie 由【后端】在登录响应里下，带 HttpOnly，前端 JS 读不到，
// 降低 XSS 窃取风险；真正的接口鉴权 token 仍由前端存 localStorage 并在请求头带 Bearer。
import type { Request, Response } from 'express';

const COOKIE_NAME = 'lm_tokens';
const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

// 合法角色键白名单。cookie 值里只允许出现这三个键，
// 任何其它键（尤其是历史脏数据里混入的 'lm_tokens' 自身）一律丢弃。
const VALID_ROLES = ['admin', 'master', 'customer'];

// 浏览器（Chrome/Firefox/Safari）单条 cookie 上限 4096 字节，超出会被【静默丢弃整条】。
// 这里留出安全余量，超过阈值时降级为「只保留当前角色」，宁可掉别的角色登录态，
// 也绝不能让整条 cookie 消失（那会导致 middleware 读不到 token，登录后被踢回 /login）。
const MAX_COOKIE_BYTES = 3500;

function parseCookies(header?: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!header) return map;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    try {
      map[k] = decodeURIComponent(raw);
    } catch {
      map[k] = raw;
    }
  }
  return map;
}

// 从请求里读出【角色 -> token】映射。
// 注意：必须先从所有 cookie 中取出 lm_tokens 这一条，再 JSON.parse 它的值；
// 直接把「整个 Cookie 头解析结果」当角色映射用，会把 lm_tokens 旧值当成一个普通键
// 嵌套进新值里，每次登录/退出都自我嵌套一层（还叠加 JSON 转义 + URL 编码），
// 导致 cookie 体积指数膨胀，约 7 次登录即突破 4096 被浏览器丢弃。
function readRoleMap(req: Request): Record<string, string> {
  const raw = parseCookies(req?.headers?.cookie)[COOKIE_NAME];
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  // 白名单过滤：顺带自愈历史遗留的膨胀脏数据，用户无需手动清 cookie
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (VALID_ROLES.includes(k) && typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

// 统一写入：带尺寸兜底，保证永远不会下发一条会被浏览器丢弃的超长 cookie
function writeRoleMap(res: Response, map: Record<string, string>, keepRole?: string) {
  let value = JSON.stringify(map);
  if (Buffer.byteLength(encodeURIComponent(value)) > MAX_COOKIE_BYTES) {
    const fallback: Record<string, string> = {};
    if (keepRole && map[keepRole]) fallback[keepRole] = map[keepRole];
    value = JSON.stringify(fallback);
  }
  res.cookie(COOKIE_NAME, value, options());
}

function options() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_MS,
  };
}

// 登录成功：把该角色 token 合并进 cookie（保留多角色共存），下发 HttpOnly cookie
export function setRoleTokenCookie(
  res: Response,
  req: Request,
  role: string,
  token: string,
) {
  const map = readRoleMap(req);
  map[role] = token;
  writeRoleMap(res, map, role);
}

// 退出：清除该角色（不传 role 则清空全部）
export function clearRoleTokenCookie(res: Response, req: Request, role?: string) {
  const map = readRoleMap(req);
  if (role) delete map[role];
  else Object.keys(map).forEach((k) => delete map[k]);
  if (Object.keys(map).length === 0) {
    res.cookie(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  } else {
    writeRoleMap(res, map);
  }
}
