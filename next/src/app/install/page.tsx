'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getInstallStatus, initSystem, getApiErrorMsg } from '@/lib/api';
import { useGlobalConfig } from '@/lib/global-config';
import { useToast } from '@/components/Toast';

type Step = 'form' | 'initializing' | 'done';

export default function InstallPage() {
  const router = useRouter();
  const toast = useToast();
  const { siteName, logoUrl } = useGlobalConfig();
  const name = siteName || '老马家电';
  const [step, setStep] = useState<Step>('form');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nickname, setNickname] = useState('超级管理员');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.title = `${name} · 系统安装`;
    getInstallStatus().then((s) => {
      if (s.installed) router.replace('/login');
    }).catch(() => {});
  }, [router, name]);

  const handleInit = async () => {
    setError('');
    if (!phone || phone.length < 3) { setError('请输入管理员手机号'); return; }
    if (!password || password.length < 6) { setError('密码至少 6 位'); return; }
    if (password !== confirm) { setError('两次密码不一致'); return; }

    setStep('initializing');
    try {
      await initSystem(phone, password, nickname);
      setStep('done');
      toast.success('系统初始化完成！');
      setTimeout(() => router.replace('/login'), 2000);
    } catch (e) {
      setStep('form');
      setError(getApiErrorMsg(e));
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 max-sm:justify-start max-sm:pt-0"
      style={{ background: 'linear-gradient(180deg, #F6FAFC 0%, #EAF1F6 100%)' }}
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-[28px] bg-white shadow-[0_8px_30px_rgba(62,143,176,0.12)] mt-6 sm:mt-0">
        {/* 品牌头 */}
        <div
          className="relative text-center px-6 pt-9 pb-12"
          style={{ background: 'linear-gradient(180deg, #F1F7FA 0%, #EAF3F8 100%)' }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 80% at 50% -10%, rgba(111,166,191,0.18), rgba(111,166,191,0) 60%)',
            }}
          />
          <div className="relative">
            <div className="mx-auto mb-4 h-16 w-16">
              {logoUrl ? (
                <img
                  src={logoUrl}
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
              {name} · 系统安装
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#7E93A0' }}>
              首次使用，请设置管理员账号
            </p>
          </div>
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

        {/* 表单区 */}
        <div className="px-6 pb-8 pt-6">
          {step === 'done' ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">安装完成</h2>
              <p className="text-sm text-gray-500">即将跳转到登录页…</p>
            </div>
          ) : step === 'initializing' ? (
            <div className="text-center py-12">
              <div
                className="inline-block w-10 h-10 border-4 rounded-full animate-spin mb-4"
                style={{
                  borderColor: 'var(--color-primary-soft)',
                  borderTopColor: 'var(--color-primary)',
                }}
              />
              <p className="text-gray-600">正在初始化系统数据…</p>
              <p className="text-xs text-gray-400 mt-2">权限 / 类目 / 服务项目 / 内容</p>
            </div>
          ) : (
            <>
              {error && (
                <div
                  className="rounded-xl px-4 py-3 text-sm mb-4"
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#DC2626',
                  }}
                >
                  {error}
                </div>
              )}
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  管理员手机号
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(62,143,176,0.14)]"
                />
              </div>
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  管理员昵称
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(62,143,176,0.14)]"
                />
              </div>
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  登录密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 位"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-11 text-[15px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(62,143,176,0.14)]"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    title={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="mb-5">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  确认密码
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(62,143,176,0.14)]"
                />
              </div>
              <button
                onClick={handleInit}
                className="w-full rounded-xl py-3.5 text-base font-medium text-white shadow-md shadow-[rgba(62,143,176,0.20)] transition active:scale-[0.99]"
                style={{
                  background: 'var(--color-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-primary-deep)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-primary)';
                }}
              >
                开始初始化
              </button>
            </>
          )}

          {/* 说明 */}
          <div className="mt-6 rounded-xl bg-[#F1F7FA] p-4 text-xs leading-5 text-[#5b7280]">
            <p className="mb-1 font-medium" style={{ color: 'var(--color-primary)' }}>
              初始化说明
            </p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>初始化将创建权限体系、服务类目、服务项目、运营内容</li>
              <li>管理员账号使用手机号登录，密码至少 6 位</li>
              <li>初始化完成后，可使用设置的手机号和密码登录管理后台</li>
              <li>如需重置系统，请在管理后台「系统设置 → 系统管理」操作</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
