// 每个角色使用独立的 localStorage key 保存 token 与用户信息，
// 同一浏览器中客户/师傅/管理员互不覆盖，退出某一端不影响其它端。

export type AppRole = 'customer' | 'master' | 'admin';

// 师傅专属资料（/auth/profile 对 master 角色额外返回）
export interface MasterInfo {
  realName?: string | null;
  idCard?: string | null;
  skills?: string[] | null;
  status?: string | null;
  province?: string | null;
  provinceCode?: string | null;
  city?: string | null;
  cityCode?: string | null;
  district?: string | null;
  districtCode?: string | null;
}

export interface UserInfo {
  id: string;
  role: AppRole;
  phone: string;
  nickname?: string | null;
  avatar?: string | null;
  status?: string | null;
  // 来自 UserProfile 的资料字段
  realName?: string | null;
  gender?: 'male' | 'female' | 'unknown' | null;
  birthday?: string | null;
  province?: string | null;
  provinceCode?: string | null;
  city?: string | null;
  cityCode?: string | null;
  district?: string | null;
  districtCode?: string | null;
  // 个人描述（自我介绍）：客户/师傅/管理员通用，个人中心最后一行维护
  bio?: string | null;
  // 是否已设置登录密码（决定个人中心显示“设置”还是“重置”）
  hasPassword?: boolean | null;
  // master 角色额外携带
  master?: MasterInfo | null;
  // RBAC：当前用户的岗位角色（后端 /auth/profile 已返回，用于前端角色感知与自降权保护）
  staffRoleId?: string | null;
  staffRoleKey?: string | null;
  // RBAC：当前账号拥有的权限码集合（后端 /auth/profile 已返回，用于侧边栏/按钮按权限过滤）
  perms?: string[] | null;
}

function tokenKey(role: AppRole): string {
  return `lm_token_${role}`;
}

function userKey(role: AppRole): string {
  return `lm_user_${role}`;
}

function refreshKey(role: AppRole): string {
  return `lm_refresh_${role}`;
}

const LAST_ROLE_KEY = 'lm_role_last';

// 根据当前路径判断所属角色，决定该用哪个 token / 用户信息。
// /client -> customer, /master -> master, /admin -> admin，其余（如 /login）返回 null。
export function roleFromPath(): AppRole | null {
  if (typeof window === 'undefined') return null;
  const p = window.location.pathname;
  if (p.startsWith('/client')) return 'customer';
  if (p.startsWith('/master')) return 'master';
  if (p.startsWith('/admin')) return 'admin';
  return null;
}

// 取当前端对应的 token（按路径自动选角色）；非端内路径返回 null。
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const role = roleFromPath();
  return role ? localStorage.getItem(tokenKey(role)) : null;
}

// 登录成功后保存该角色的 token（只写自己的槽位，不碰其它角色）。
// 注：路由拦截用的 lm_tokens cookie 由【后端】在登录响应里下发（HttpOnly），
// 前端不再写 cookie，避免 JS 可读带来的 XSS 暴露。
export function setSession(token: string, role: AppRole) {
  localStorage.setItem(tokenKey(role), token);
  localStorage.setItem(LAST_ROLE_KEY, role);
}

// 退出时只清当前角色的 token；传入 role 可指定清哪个。
// 不清其它角色，保证多端共存时一端退出不影响其它端。
// cookie 的清除由后端 /auth/logout 负责（HttpOnly，前端无法删）。
export function clearSession(role?: AppRole) {
  if (typeof window === 'undefined') return;
  const target = role ?? roleFromPath();
  if (target) {
    localStorage.removeItem(tokenKey(target));
    localStorage.removeItem(refreshKey(target));
  }
  if (!role) localStorage.removeItem(LAST_ROLE_KEY);
}

// 登录成功时保存该角色的 refreshToken（只写自己的槽位，不碰其它角色）
export function setRefreshToken(role: AppRole, rt: string) {
  localStorage.setItem(refreshKey(role), rt);
}

// 取当前端对应的 refreshToken（按路径自动选角色）；非端内路径返回 null
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  const role = roleFromPath();
  return role ? localStorage.getItem(refreshKey(role)) : null;
}

// 清当前角色的 refreshToken；传入 role 可指定清哪个，否则按路径推断
export function clearRefreshToken(role?: AppRole) {
  if (typeof window === 'undefined') return;
  const target = role ?? roleFromPath();
  if (target) localStorage.removeItem(refreshKey(target));
  if (!role) {
    (['customer', 'master', 'admin'] as AppRole[]).forEach((r) =>
      localStorage.removeItem(refreshKey(r)),
    );
  }
}

export function getRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_ROLE_KEY);
}

// 从 JWT 中解出 role（payload 第二段 base64url）。用于密码登录后按角色跳转，
// 因为密码登录不依赖登录页选择角色（手机号唯一标识用户）。
export function roleFromToken(token: string): AppRole | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = JSON.parse(
      decodeURIComponent(
        atob(part.replace(/-/g, '+').replace(/_/g, '/')),
      ),
    );
    const r = json.role;
    return r === 'admin' || r === 'master' || r === 'customer' ? r : null;
  } catch {
    return null;
  }
}

// ---- 用户信息（按角色分 key 的 localStorage 缓存）----

export function getUserCache(role: AppRole): UserInfo | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(userKey(role));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

export function setUserCache(role: AppRole, info: UserInfo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(userKey(role), JSON.stringify(info));
}

export function clearUserCache(role?: AppRole): void {
  if (typeof window === 'undefined') return;
  const target = role ?? roleFromPath();
  if (target) localStorage.removeItem(userKey(target));
  if (!role) {
    (['customer', 'master', 'admin'] as AppRole[]).forEach((r) =>
      localStorage.removeItem(userKey(r)),
    );
  }
}
