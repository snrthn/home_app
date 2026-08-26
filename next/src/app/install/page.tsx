'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getInstallStatus, initSystem, getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';

type Step = 'form' | 'initializing' | 'done';

export default function InstallPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>('form');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nickname, setNickname] = useState('超级管理员');
  const [error, setError] = useState('');

  useEffect(() => {
    getInstallStatus().then((s) => {
      if (s.installed) router.replace('/login');
    }).catch(() => {});
  }, [router]);

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white text-2xl font-bold mb-4">
            老
          </div>
          <h1 className="text-2xl font-bold text-gray-900">老马家电 · 系统安装</h1>
          <p className="text-sm text-gray-500 mt-2">首次使用，请设置管理员账号</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          {step === 'done' ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">安装完成</h2>
              <p className="text-sm text-gray-500">即将跳转到登录页…</p>
            </div>
          ) : step === 'initializing' ? (
            <div className="text-center py-12">
              <div className="inline-block w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <p className="text-gray-600">正在初始化系统数据…</p>
              <p className="text-xs text-gray-400 mt-2">权限 / 类目 / 服务项目 / 内容</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">管理员手机号</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">管理员昵称</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">登录密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">确认密码</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                />
              </div>
              <button
                onClick={handleInit}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
              >
                开始初始化
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          初始化将创建权限体系、服务类目、服务项目、运营内容和管理员账号
        </p>
      </div>
    </div>
  );
}
