'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  requestSmsCode,
  resetPassword,
  notifySmsResult,
  getApiErrorMsg,
} from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useGlobalConfig } from '@/lib/global-config';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const { siteName } = useGlobalConfig();
  const name = siteName || '老马家电';

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

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
    const phoneVal = phone.trim();
    const codeVal = code.trim();
    const pwdVal = newPassword.trim();
    const confirmVal = confirmPassword.trim();

    if (!/^1\d{10}$/.test(phoneVal)) {
      toast.warning('请输入 11 位手机号');
      return;
    }
    if (!codeVal) {
      toast.warning('请输入验证码');
      return;
    }
    if (pwdVal.length < 6) {
      toast.warning('新密码至少 6 位');
      return;
    }
    if (pwdVal !== confirmVal) {
      toast.warning('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ phone: phoneVal, code: codeVal, newPassword: pwdVal });
      toast.success('密码已重置，正在跳转登录…');
      setTimeout(() => router.push('/login?mode=password'), 1200);
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 max-sm:justify-start max-sm:pt-0"
      style={{ background: 'linear-gradient(180deg, #F6FAFC 0%, #EAF1F6 100%)' }}
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-[28px] bg-white shadow-[0_8px_30px_rgba(62,143,176,0.12)] mt-6 sm:mt-0">
        {/* 简洁品牌头 */}
        <div
          className="relative px-6 pt-8 pb-10 text-center"
          style={{ background: 'linear-gradient(180deg, #F1F7FA 0%, #EAF3F8 100%)' }}
        >
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--color-primary-text)' }}
          >
            {name}
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#7E93A0' }}>
            找回密码
          </p>
        </div>

        {/* 表单区 */}
        <div className="px-6 pb-8 pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {/* 手机号 */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                手机号
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(62,143,176,0.14)]"
                placeholder="请输入 11 位手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={11}
              />
            </div>

            {/* 验证码 */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                验证码
              </label>
              <div className="flex gap-3">
                <input
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(62,143,176,0.14)]"
                  placeholder="6 位验证码"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
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

            {/* 新密码 */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                新密码
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(62,143,176,0.14)]"
                type="password"
                placeholder="至少 6 位"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            {/* 确认密码 */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                确认新密码
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgba(62,143,176,0.14)]"
                type="password"
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[var(--color-primary)] py-3.5 text-base font-medium text-white shadow-md shadow-[rgba(62,143,176,0.20)] transition hover:bg-[var(--color-primary-deep)] active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? '重置中…' : '重置密码'}
            </button>
          </form>

          {/* 返回登录 */}
          <div className="mt-5 text-center">
            <Link
              href="/login"
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              ← 返回登录
            </Link>
          </div>

          {/* 说明 */}
          <div className="mt-6 rounded-xl bg-[#F1F7FA] p-4 text-xs leading-5 text-[#5b7280]">
            <p className="mb-1 font-medium text-[var(--color-primary)]">找回密码说明</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>输入注册时的手机号，获取验证码</li>
              <li>验证码将以 Toast 弹窗方式显示（开发模式）</li>
              <li>验证通过后即可设置新密码，无需旧密码</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
