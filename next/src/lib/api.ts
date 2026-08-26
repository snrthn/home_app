import axios from 'axios';
import { getToken, clearSession, clearUserCache, setSession, getRefreshToken, setRefreshToken, roleFromPath } from './auth';
import { queryClient } from '@/app/providers';
import type { ToastApi } from '@/components/Toast';

// 解析 API 基地址：
// - 优先用环境变量 NEXT_PUBLIC_API_BASE（部署/联调时可显式指定）。
// - 否则跟随「页面实际访问的 host」拼后端端口，而不是写死 localhost。
//   原因：lm_tokens 是 HttpOnly cookie，作用域按 host 绑定。若前端用 127.0.0.1 打开、
//   而后端 API 基地址写死 localhost:3721，后端下的 cookie 落在 localhost 主机上，
//   浏览器不会把它带到 127.0.0.1 的页面，middleware 读不到 cookie 就会把首页重定向回 /login，
//   表现为「登录 201 成功、但不跳首页、也不调 profile、控制台无报错」。
//   跟随页面 host 后，localhost / 127.0.0.1 / 局域网 IP 三种打开方式都能一致拿到 cookie。
function resolveApiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE;
  if (env) return env;
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3721/api/v1`;
  }
  return 'http://localhost:3721/api/v1';
}

const API_BASE = resolveApiBase();

const api = axios.create({
  baseURL: API_BASE,
  // 跨端口（前端 3824 / 后端 3721）登录时后端会下 HttpOnly 的 lm_tokens cookie，
  // 浏览器仅在 withCredentials=true 时才会在跨域响应里留存该 cookie，middleware 才能读到。
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 单飞刷新：多个并发请求同时 401 时，只发起一次 refresh，其余复用其结果，避免刷新风暴。
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const rt = getRefreshToken();
    if (!rt) throw new Error('no_refresh_token');
    const resp = await api.post('/auth/refresh', { refreshToken: rt });
    const { accessToken: newAt, refreshToken: newRt } = (resp.data ?? {}) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!newAt) throw new Error('refresh_failed');
    const role = roleFromPath();
    if (role) {
      setSession(newAt, role);
      if (newRt) setRefreshToken(role, newRt);
    }
    return newAt;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// 全局 401 处置：凭证失效时先尝试用 refreshToken 静默续期并重试原请求；
// 续期失败（refreshToken 也过期）才清掉本地登录态并跳登录页。
// - 排除 /auth/ 自身（登录/刷新/登出不能触发，否则互相套娃无限循环）
// - 清 localStorage（token + 用户缓存）、尽力清后端 HttpOnly cookie（/auth/logout 幂等，
//   token 失效也成功返回），再清 react-query 缓存，最后硬跳 /login 保证干净状态。
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || '';
    const original = error.config as any;
    if (
      status === 401 &&
      !url.includes('/auth/') &&
      original &&
      !original._retry
    ) {
      original._retry = true;
      try {
        const newToken = await refreshAccessToken();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        clearSession();
        clearUserCache();
        logoutApi().catch(() => {});
        queryClient.clear();
        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login'
        ) {
          const role = roleFromPath();
          const loginUrl = role === 'admin' ? '/login?mode=admin&role=customer' : '/login';
          window.location.href = loginUrl;
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;

/**
 * 统一提取后端非 200 的提示文案。
 * NestJS 校验失败（ValidationPipe）时 message 是 string[]，需 join；
 * 网络层异常（超时 / 断网 / CORS）没有 response，要给可读兜底。
 * 集中在此避免各业务代码散落 e?.response?.data?.message 的写法。
 */
export function getApiErrorMsg(e: unknown): string {
  const err = e as {
    response?: { status?: number; data?: { message?: unknown } };
  };
  const data = err?.response?.data;
  if (data?.message !== undefined && data?.message !== null) {
    return Array.isArray(data.message)
      ? data.message.join('；')
      : String(data.message);
  }
  if (err?.response?.status) {
    return `请求失败（${err.response.status}）`;
  }
  // 无 response：断网 / 超时 / CORS 等网络层异常
  return '网络异常，请稍后重试';
}

// 后端上传接口基于全局前缀 api，静态资源挂在 /uploads。
// 这里把相对路径（/uploads/xxx.jpg）解析为带源站的绝对地址，跨端口（前端 3824 / 后端 3721）也能正常显示。
const API_ORIGIN = API_BASE.replace(/\/api(\/v\d+)?$/, '');

export function resolveAsset(pathOrUrl?: string | null): string {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return API_ORIGIN + pathOrUrl;
}

// 上传文件（头像 / Logo / 封面等通用）：multipart 表单，字段名 file，
// 返回后端给的相对 URL（/uploads/xxx.jpg）。POST /api/upload 由 JWT 守卫。
export function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  return api
    .post('/upload', form)
    .then((r) => (r.data && r.data.url) || '');
}

// 上传头像：复用通用上传链路，返回后端给的相对 URL（/uploads/xxx.jpg）
export function uploadAvatar(file: File): Promise<string> {
  return uploadFile(file);
}

// 退出登录：调用后端受保护接口，成功后由调用方清本地会话
export function logoutApi() {
  return api.post('/auth/logout');
}

// 登录心跳：刷新 lastActiveAt 保活在线状态（工作台「在线师傅」统计依据）。
// 失败静默——token 失效时由 401 拦截器统一处理登录态。
export function heartbeatApi() {
  return api.post('/auth/heartbeat').catch(() => undefined);
}

// 个人中心：拉取当前用户资料（含 UserProfile / Master 字段）
export function getProfile() {
  return api.get('/auth/profile').then((r) => r.data);
}

// PATCH /api/auth/profile：更新 UserProfile（昵称/头像/实名/性别/生日/所在地）
export function updateProfile(dto: Record<string, unknown>) {
  return api.patch('/auth/profile', dto);
}

// PATCH /api/masters/me：师傅完善自身专属资料（实名/身份证/技能/服务区域）
export function updateMasterMe(dto: Record<string, unknown>) {
  return api.patch('/masters/me', dto);
}

// GET /api/config/global：公开，无需登录。返回全局配置（系统名称/主题色/客服电话等）。
export function getGlobalConfig() {
  return api.get('/config/global').then((r) => r.data);
}

// PATCH /api/admin/config/global：仅管理员，更新全局配置
export function updateGlobalConfig(dto: Record<string, unknown>) {
  return api.patch('/admin/config/global', dto);
}

// POST /api/auth/password：设置或重置登录密码（需登录态）。
// 首次设置可不传 oldPassword；重置必须传 oldPassword 且与当前密码一致。
export function setPassword(dto: {
  oldPassword?: string;
  newPassword: string;
}) {
  return api.post('/auth/password', dto);
}

// POST /api/auth/send-code：发送登录/重置验证码（公开）。
// 开发模式（SMS_MOCK≠false）下，后端会在响应里带回 code，便于本地调试。
export function requestSmsCode(phone: string) {
  return api.post<{ ok: boolean; code?: string; dev?: boolean }>(
    '/auth/send-code',
    { phone },
  );
}

// POST /api/auth/reset-password：找回密码（公开，无需登录态）。
// 以「手机号 + 验证码」完成身份核验后直接设置新密码，绕过旧密码。
export function resetPassword(dto: {
  phone: string;
  code: string;
  newPassword: string;
}) {
  return api.post('/auth/reset-password', dto);
}

// 发码结果反馈：开发模式携带 code 时，醒目 Toast 展示 + 控制台打印；
// 生产模式不返回 code，仅提示「验证码已发送」。登录页与找回密码页共用。
export function notifySmsResult(
  toast: ToastApi,
  data: { ok: boolean; code?: string; dev?: boolean },
) {
  if (data.code) {
    // eslint-disable-next-line no-console
    console.log(`[DEV] 短信验证码（开发模式）：${data.code}`);
    toast.success(`【开发模式】验证码：${data.code}`);
  } else {
    toast.success('验证码已发送');
  }
}

// GET /install/status — 公开，检查系统是否已初始化
export function getInstallStatus() {
  return api.get<{ installed: boolean; installedAt: string | null }>('/install/status').then(r => r.data);
}

// POST /install/init — 公开，执行系统初始化（创建管理员+灌入种子数据）
export function initSystem(phone: string, password: string, nickname?: string) {
  return api.post('/install/init', { phone, password, nickname });
}

// POST /install/reset — 管理员，重置系统到未安装状态（需校验当前密码）
export function resetSystem(mode: 'light' | 'deep' = 'light', password: string) {
  return api.post('/install/reset', { password }, { params: { mode } });
}
