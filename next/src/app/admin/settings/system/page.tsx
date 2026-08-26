'use client';

import { useState, useEffect } from 'react';
import { resetSystem, getInstallStatus, getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function SystemSettingsPage() {
  const toast = useToast();
  const [installed, setInstalled] = useState(false);
  const [installedAt, setInstalledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [pendingMode, setPendingMode] = useState<'light' | 'deep' | null>(null);

  const fetchStatus = () => {
    setLoading(true);
    getInstallStatus()
      .then((s) => {
        setInstalled(s.installed);
        setInstalledAt(s.installedAt);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleReset = (mode: 'light' | 'deep') => {
    setPendingMode(mode);
    setConfirmText('');
    setAdminPassword('');
  };

  const confirmReset = async () => {
    if (confirmText !== '确认重置') return;
    if (!pendingMode) return;
    if (!adminPassword) return;
    setResetting(true);
    try {
      await resetSystem(pendingMode, adminPassword);
      toast.success('系统已重置，即将跳转到安装页面');
      setTimeout(() => { window.location.href = '/install'; }, 2000);
    } catch (e) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setResetting(false);
      setPendingMode(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">系统管理</h1>
        <p className="text-sm text-gray-500 mt-1">查看安装状态、重置系统数据</p>
      </div>

      {/* 安装状态 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">安装状态</h2>
        {loading ? (
          <div className="text-gray-400 text-sm">加载中…</div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">状态：</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${installed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {installed ? '已安装' : '未安装'}
              </span>
            </div>
            {installedAt && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">安装时间：</span>
                <span className="text-sm text-gray-700">{new Date(installedAt).toLocaleString('zh-CN')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 轻度重置 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-2">轻度重置</h2>
        <p className="text-sm text-gray-500 mb-4">将系统标记为未安装状态，保留用户、订单等业务数据。重置后需重新走安装向导初始化种子数据。</p>
        <button
          onClick={() => handleReset('light')}
          className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition"
        >
          轻度重置
        </button>
      </div>

      {/* 深度重置 */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-base font-semibold text-red-700 mb-2">深度重置（危险）</h2>
        <p className="text-sm text-gray-500 mb-4">清空所有业务数据（用户、订单、支付、师傅、类目、项目等），仅保留表结构。适用于试运营结束后的生产切换。</p>
        <button
          onClick={() => handleReset('deep')}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
        >
          深度重置
        </button>
      </div>

      {/* 确认弹窗 */}
      {pendingMode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {pendingMode === 'deep' ? '⚠️ 确认深度重置' : '确认轻度重置'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {pendingMode === 'deep'
                ? '此操作将清空所有数据，不可恢复。请输入"确认重置"以继续。'
                : '此操作将系统标记为未安装，需重新初始化。请输入"确认重置"以继续。'}
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='请输入"确认重置"'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500 mb-3"
            />
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="请输入当前登录密码"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setPendingMode(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
              >
                取消
              </button>
              <button
                onClick={confirmReset}
                disabled={confirmText !== '确认重置' || !adminPassword || resetting}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {resetting ? '重置中…' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
