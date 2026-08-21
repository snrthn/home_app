'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api, { getApiErrorMsg, resolveAsset, requestSmsCode, notifySmsResult } from '@/lib/api';
import { setSession, roleFromToken, setRefreshToken } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { getAgreementDefault } from '@/lib/admin-api';
import { useGlobalConfig } from '@/lib/global-config';

type Mode = 'code' | 'password' | 'admin';

// 品牌头：Logo + 名称 + 描述 + 渐变背景块 + 径向光晕 + 弧线分割
// context='card' → 用于桌面端，渲染在白卡片内部（卡片自带圆角裁切）
// context='page' → 用于手机端，独立圆角面板置于页面顶部（移出卡片）
function BrandHeader({ context }: { context: 'card' | 'page' }) {
  const isPage = context === 'page';
  const { siteName, logoUrl } = useGlobalConfig();
  const name = siteName || '老马家电';
  useEffect(() => {
    if (typeof document !== 'undefined') document.title = name;
  }, [name]);
  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };
  return (
    <div
      className={
        'relative text-center ' +
        (isPage
          ? 'w-full overflow-hidden px-6 pt-9 pb-16'
          : 'px-6 pt-9 pb-12')
      }
      style={{
        background: 'linear-gradient(180deg, #F1F7FA 0%, #EAF3F8 100%)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, rgba(111,166,191,0.18), rgba(111,166,191,0) 60%)',
        }}
      />
      <div className="relative">
        {/* 双击全屏：挂在 Logo 容器上，无论用配置 Logo 还是兜底图标都生效 */}
        <div
          className="mx-auto mb-4 h-16 w-16"
          onDoubleClick={toggleFullscreen}
          title="双击切换全屏"
        >
          {logoUrl ? (
            <img
              src={resolveAsset(logoUrl)}
              alt={name}
              className="h-16 w-16 rounded-full object-cover shadow-md"
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full shadow-md"
              style={{ background: 'var(--color-primary-weak)' }}
            >
              <svg
                className="h-9 w-9 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          )}
        </div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--color-primary-text)' }}
        >
          {name}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#7E93A0' }}>
          清洗 · 维修 · 上门服务
        </p>
      </div>
      {/* 弧线分割（若有若无的半透明白线，弧度适度、位置上移） */}
      <svg
        className="absolute bottom-4 left-0 w-full"
        height="20"
        viewBox="0 0 420 20"
        preserveAspectRatio="none"
      >
        <path
          d="M0,3 Q210,17 420,3"
          fill="none"
          stroke="rgba(255,255,255,0.38)"
          strokeWidth="0.75"
        />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('password');
  const [role, setRole] = useState<'customer' | 'master'>('customer');

  // 从 URL(如 ?mode=admin&role=master)恢复上一次选中的 tab/角色：
  // 查看协议页后「浏览器后退」回到登录页时，组件会重新挂载、useState 归零，
  // 这里在挂载后读 URL 把选中态还原，避免 Tab 被重置。
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const m = sp.get('mode');
    const r = sp.get('role');
    if (m === 'code' || m === 'password' || m === 'admin') setMode(m);
    if (r === 'master') setRole('master');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换 tab/角色时把选中态写回 URL（replace，不新增历史记录），
  // 保证后退返回时仍能读到。
  const syncTabToUrl = (m: Mode, r: 'customer' | 'master') => {
    router.replace(`/login?mode=${m}&role=${r}`, { scroll: false });
  };
  const handleModeChange = (m: Mode) => {
    setMode(m);
    syncTabToUrl(m, role);
  };
  const handleRoleChange = (r: 'customer' | 'master') => {
    setRole(r);
    syncTabToUrl(mode, r);
  };
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  // 注册模式下，按当前所选端拉取「当前生效」的注册协议与隐私政策；
  // 后端无生效版本时返回 null，前端据此隐藏对应入口（下架/未上架则不展示）。
  const agreementScope = role; // 'customer' | 'master'
  const regQ = useQuery({
    queryKey: ['agreement', 'default', agreementScope, 'registration'],
    queryFn: () => getAgreementDefault(agreementScope, 'registration'),
    enabled: mode === 'code',
  });
  const priQ = useQuery({
    queryKey: ['agreement', 'default', agreementScope, 'privacy'],
    queryFn: () => getAgreementDefault(agreementScope, 'privacy'),
    enabled: mode === 'code',
  });
  // 管理员登录界面：拉取平台端(admin scope)当前生效协议，作为「平台协议」查看入口
  const adminRegQ = useQuery({
    queryKey: ['agreement', 'default', 'admin', 'registration'],
    queryFn: () => getAgreementDefault('admin', 'registration'),
    enabled: mode === 'admin',
  });
  const adminPriQ = useQuery({
    queryKey: ['agreement', 'default', 'admin', 'privacy'],
    queryFn: () => getAgreementDefault('admin', 'privacy'),
    enabled: mode === 'admin',
  });

  const sendCode = async () => {
    if (!/^1\d{10}$/.test(phone)) {
      toast.warning('请输入 11 位手机号');
      return;
    }
    try {
      const resp = await requestSmsCode(phone);
      notifySmsResult(toast, resp.data);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((n) => {
          if (n <= 1) clearInterval(timer);
          return n - 1;
        });
      }, 1000);
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };

  const submit = async () => {
    try {
      // 空值校验：提交前先拦掉缺字段的情况，不再打无效请求
      const phoneVal = phone.trim();
      const pwdVal = password.trim();
      const codeVal = code.trim();
      if (!phoneVal) {
        toast.warning(mode === 'admin' ? '请输入管理员账号' : '请输入手机号');
        return;
      }
      if (mode === 'code') {
        if (!/^1\d{10}$/.test(phoneVal)) {
          toast.warning('请输入 11 位手机号');
          return;
        }
        if (!codeVal) {
          toast.warning('请输入验证码');
          return;
        }
      } else {
        // 密码登录 / 管理员登录都需要密码
        if (!pwdVal) {
          toast.warning('请输入密码');
          return;
        }
      }

      const body: Record<string, unknown> = { phone: phoneVal, mode };
      if (mode === 'code') {
        body.code = codeVal;
        body.role = role;
      } else {
        body.password = pwdVal;
      }
      const res = await api.post('/auth/login', body);
      const { accessToken, refreshToken } = res.data;
      // 密码登录：手机号唯一标识用户，角色从 token 解出来决定跳转
      // 验证码登录同样以服务端签发的角色为准（与密码登录一致），
      // 避免“本地选了师傅、DB/服务端却是客户”导致写错槽位、跳错端、middleware 踢回。
      const r =
        mode === 'admin' ? 'admin' : roleFromToken(accessToken) ?? 'customer';
      setSession(accessToken, r);
      if (refreshToken) setRefreshToken(r, refreshToken);
      toast.success('登录成功，跳转中…');
      router.push(
        r === 'admin' ? '/admin' : r === 'master' ? '/master' : '/client',
      );
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };

  const tabs: { key: Mode; label: string }[] = [
    { key: 'code', label: '注册' },
    { key: 'password', label: '密码登录' },
    { key: 'admin', label: '管理员' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 max-sm:justify-start max-sm:pt-0"
      style={{
        background:
          'linear-gradient(180deg, #F6FAFC 0%, #EAF1F6 100%)',
      }}
    >
      {/* 移动端：品牌头移出卡片，铺满页面顶部、上下左右贴边（仅手机显示，大屏隐藏） */}
      <div className="sm:hidden -mx-4 self-stretch">
        <BrandHeader context="page" />
      </div>

      <div className="w-full max-w-[420px] overflow-hidden rounded-[28px] bg-white shadow-[0_8px_30px_rgba(62,143,176,0.12)] mt-6 sm:mt-0">
        {/* 桌面端：品牌头保留在卡片内（仅大屏显示，手机隐藏） */}
        <div className="hidden sm:block">
          <BrandHeader context="card" />
        </div>

        {/* 表单区（白底） */}
        <div className="px-6 pb-8 pt-6">
          {/* 登录方式切换 */}
          <div className="mb-6 flex rounded-xl bg-[#F1F7FA] p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => handleModeChange(t.key)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  mode === t.key
                    ? 'bg-white text-[var(--color-primary)] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 角色选择（仅注册） */}
          {mode === 'code' && (
            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleRoleChange('customer')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                  role === 'customer'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
                我是客户
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('master')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                  role === 'master'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276A4.5 4.5 0 0121.75 6.75z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.867 19.125h.008v.008h-.008v-.008z"
                  />
                </svg>
                我是师傅
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {/* 账号 */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {mode === 'admin' ? '管理员账号' : '手机号'}
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(62,143,176,0.14)]"
                placeholder={mode === 'admin' ? 'admin' : '请输入 11 位手机号'}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {/* 密码登录 / 管理员：直接填密码 */}
            {mode !== 'code' ? (
              <div className="mb-5">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  密码
                </label>
                <input
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(62,143,176,0.14)]"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            ) : (
              /* 注册：验证码 + 获取按钮 */
              <div className="mb-5">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  验证码
                </label>
                <div className="flex gap-3">
                  <input
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(62,143,176,0.14)]"
                    placeholder="6 位验证码"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={countdown > 0}
                    className="shrink-0 rounded-xl border border-[var(--color-primary)] px-4 py-3 text-sm font-medium text-[var(--color-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </button>
                </div>
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--color-primary)] py-3.5 text-base font-medium text-white shadow-md shadow-[rgba(62,143,176,0.20)] transition hover:bg-[var(--color-primary-deep)] active:scale-[0.99]"
            >
              {mode === 'admin' ? '管理员登录' : mode === 'password' ? '密码登录' : '注册并登录'}
            </button>
          </form>

          {/* 密码登录模式：忘记密码入口 */}
          {mode === 'password' && (
            <div className="mt-3 text-center">
              <Link
                href="/forgot-password"
                className="text-sm text-[var(--color-primary)] hover:underline"
              >
                忘记密码？
              </Link>
            </div>
          )}

          {/* 注册协议与隐私政策入口：仅在注册模式、且对应端存在「当前生效」版本时展示，点击在当前页面打开公开展示页 */}
          {mode === 'code' && (regQ.data || priQ.data) && (
            <div className="agreement-consent">
              <span>注册即代表已阅读并同意</span>
              {regQ.data && (
                <Link
                  href={`/agreements/${regQ.data.code}`}
                  className="agreement-link"
                >
                  《{regQ.data.title}》
                </Link>
              )}
              {priQ.data && (
                <Link
                  href={`/agreements/${priQ.data.code}`}
                  className="agreement-link"
                >
                  《{priQ.data.title}》
                </Link>
              )}
            </div>
          )}

          {/* 管理员登录界面：平台端协议查看入口（运营平台注册协议 / 隐私政策），点击在当前页面打开公开展示页 */}
          {mode === 'admin' && (adminRegQ.data || adminPriQ.data) && (
            <div className="agreement-consent">
              <span>平台协议：</span>
              {adminRegQ.data && (
                <Link
                  href={`/agreements/${adminRegQ.data.code}`}
                  className="agreement-link"
                >
                  《{adminRegQ.data.title}》
                </Link>
              )}
              {adminPriQ.data && (
                <Link
                  href={`/agreements/${adminPriQ.data.code}`}
                  className="agreement-link"
                >
                  《{adminPriQ.data.title}》
                </Link>
              )}
            </div>
          )}

          {/* 登录说明（无左侧边框，仅浅冷底 + 圆角） */}
          <div className="mt-6 rounded-xl bg-[#F1F7FA] p-4 text-xs leading-5 text-[#5b7280]">
            <p className="mb-1 font-medium text-[var(--color-primary)]">怎么登录？</p>
            {mode === 'admin' ? (
              <ul className="list-disc space-y-0.5 pl-4">
                <li>管理员账号：admin</li>
                <li>默认密码：admin123</li>
                <li>首次使用请确保已执行 init-admin.sql</li>
              </ul>
            ) : mode === 'password' ? (
              <ul className="list-disc space-y-0.5 pl-4">
                <li>使用「手机号 + 密码」登录</li>
                <li>首次使用请先到「注册」页创建账号并在个人中心设置密码</li>
                <li>忘记密码？点击上方「忘记密码」链接找回</li>
              </ul>
            ) : (
              <ul className="list-disc space-y-0.5 pl-4">
                <li>输入手机号，点「获取验证码」</li>
                <li>验证码将以 Toast 弹窗方式显示（开发模式）</li>
                <li>首次将自动创建账号（客户/师傅），已注册可直接登录</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
