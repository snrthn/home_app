'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveAsset } from '@/lib/api';
import { QK } from '@/lib/query-keys';
import { useCurrentUser, fetchProfile } from '@/lib/useCurrentUser';
import { useLogout } from '@/lib/useLogout';
import { useToast } from '@/components/Toast';
import { PortalNavSetter } from '@/components/PortalShell';
import Cell from '@/components/Cell';
import MeEntry from '@/components/MeEntry';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PasswordDialog } from '@/components/form';

const AGREEMENTS = {
  reg: '/client/agreements/customer-registration',
  pri: '/client/agreements/customer-privacy',
};

function maskPhone(p?: string) {
  if (!p) return '';
  return p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

// ---- 功能入口图标（内联 SVG，跨端一致）----
function IconOrder() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}
function IconNotice() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11l14-6v14L3 13z" />
      <path d="M3 11v2a2 2 0 0 0 2 2h1" />
    </svg>
  );
}
function IconAddress() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function IconService() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12a8 8 0 0 1 16 0" />
      <rect x="3" y="12" width="4" height="6" rx="2" />
      <rect x="17" y="12" width="4" height="6" rx="2" />
      <path d="M19 18a4 4 0 0 1-4 3h-2" />
    </svg>
  );
}
function DefaultAvatar() {
  return (
    <svg viewBox="0 0 48 48" width="56" height="56" aria-hidden>
      <circle cx="24" cy="24" r="24" fill="#e8f0f4" />
      <circle cx="24" cy="19" r="9" fill="#b9cdd8" />
      <path d="M9 41c2-8 9-12 15-12s13 4 15 12z" fill="#b9cdd8" />
    </svg>
  );
}

export default function ClientMe() {
  useCurrentUser('customer');
  const toast = useToast();
  const logout = useLogout();

  const { data, isLoading } = useQuery({
    queryKey: QK.profile('customer'),
    queryFn: fetchProfile,
  });

  const [showPwd, setShowPwd] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  if (isLoading) {
    return (
      <div className="laoma-container">
        <div className="card">加载中…</div>
      </div>
    );
  }

  const profile = data as any;
  const phone = maskPhone(profile?.phone);
  const avatar = profile?.avatar ?? '';

  return (
    <>
      <PortalNavSetter
        title="我的"
        showBack
        backHref="/client"
        menu={[{ label: '关于我们', href: '/client/about' }]}
      />

      <div className="laoma-container me-page">
        {/* 用户信息（保持不变） */}
        <div className="me-profile">
          <div className="me-avatar">
            {avatar ? <img src={resolveAsset(avatar)} alt="头像" /> : <DefaultAvatar />}
          </div>
          <div className="me-profile-meta">
            <div className="me-name">{profile?.nickname || '未设置昵称'}</div>
            <div className="me-sub">{phone || '客户'}</div>
          </div>
        </div>

        {/* 快速入口（保持不变） */}
        <div className="me-grid">
          <MeEntry label="我的订单" icon={<IconOrder />} onClick={() => toast.info('订单功能建设中')} />
          <MeEntry label="平台公告" icon={<IconNotice />} href="/client/notices" />
          <MeEntry label="我的地址" icon={<IconAddress />} href="/client/me/addresses" />
          <MeEntry label="在线客服" icon={<IconService />} onClick={() => toast.info('在线客服建设中')} />
        </div>

        {/* 功能入口 */}
        <div className="me-section">
          <div className="me-section-title">功能入口</div>
          <div className="card me-cells">
            <Cell label="修改资料" href="/client/me/edit" />
            <Cell label="修改密码" onClick={() => setShowPwd(true)} />
          </div>
        </div>

        {/* 协议与隐私 */}
        <div className="me-section">
          <div className="me-section-title">协议与隐私</div>
          <div className="card me-cells">
            <Cell label="用户协议" href={AGREEMENTS.reg} />
            <Cell label="隐私政策" href={AGREEMENTS.pri} />
            <Cell label="关于我们" href="/client/about" />
          </div>
        </div>

        {/* 退出按钮（最底部） */}
        <button type="button" className="me-logout" onClick={() => setShowLogout(true)}>
          退出登录
        </button>
      </div>

      <PasswordDialog
        hasPassword={!!profile?.hasPassword}
        open={showPwd}
        onClose={() => setShowPwd(false)}
        onSuccess={() => {}}
      />

      <ConfirmDialog
        open={showLogout}
        title="确认退出登录？"
        message="退出后需重新登录，本端会话不会保留。"
        confirmLabel="确认退出"
        cancelLabel="取消"
        onConfirm={() => {
          setShowLogout(false);
          logout();
        }}
        onCancel={() => setShowLogout(false)}
      />
    </>
  );
}
