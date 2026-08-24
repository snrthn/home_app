'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveAsset } from '@/lib/api';
import { QK } from '@/lib/query-keys';
import { useCurrentUser, fetchProfile } from '@/lib/useCurrentUser';
import { useLogout } from '@/lib/useLogout';
import { PortalNavSetter } from '@/components/PortalShell';
import Cell from '@/components/Cell';
import MeEntry from '@/components/MeEntry';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PasswordDialog } from '@/components/form';

const STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  active: '已通过',
  disabled: '已停用',
};

const AGREEMENTS = {
  reg: '/master/agreements/master-registration',
  pri: '/master/agreements/master-privacy',
};

function maskPhone(p?: string) {
  if (!p) return '';
  return p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

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
function IconGear() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 9h13a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3" />
      <circle cx="16.5" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconTicket() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16v10H4z" />
      <path d="M4 9.5h16" />
      <path d="M9 7v10" />
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

export default function MasterMe() {
  useCurrentUser('master');
  const logout = useLogout();

  const { data, isLoading } = useQuery({
    queryKey: QK.profile('master'),
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
  const masterStatus = profile?.master?.status ?? '';
  const statusPassed = masterStatus === 'active';

  return (
    <>
      <PortalNavSetter
        title="我的"
        showBack
        backHref="/master"
        menu={[{ label: '关于我们', href: '/master/about' }]}
      />

      <div className="laoma-container me-page">
        {/* 用户信息（保持不变） */}
        <div className="me-profile">
          <div className="me-avatar">
            {avatar ? <img src={resolveAsset(avatar)} alt="头像" /> : <DefaultAvatar />}
          </div>
          <div className="me-profile-meta">
            <div className="me-name">{profile?.nickname || '未设置昵称'}</div>
            <div className="me-sub">
              {phone || '师傅'}
              <span className="me-status" style={{ color: statusPassed ? '#16a34a' : 'var(--color-text-soft)' }}>
                · {STATUS_LABEL[masterStatus] ?? '待审核'}
              </span>
            </div>
          </div>
        </div>

        {/* 快速入口（保持不变） */}
        <div className="me-grid">
          <MeEntry label="我的订单" icon={<IconOrder />} href="/master/orders/mine" />
          <MeEntry label="我的工单" icon={<IconTicket />} href="/master/tickets" />
          <MeEntry label="接单设置" icon={<IconGear />} href="/master/me/accept-settings" />
          <MeEntry label="收入提现" icon={<IconWallet />} href="/master/me/income" />
        </div>

        {/* 功能入口 */}
        <div className="me-section">
          <div className="me-section-title">功能入口</div>
          <div className="card me-cells">
            <Cell label="修改资料" href="/master/me/edit" />
            <Cell label="修改密码" onClick={() => setShowPwd(true)} />
            <Cell label="在线客服" href="/master/me/online-service" />
          </div>
        </div>

        {/* 协议与隐私 */}
        <div className="me-section">
          <div className="me-section-title">协议与隐私</div>
          <div className="card me-cells">
            <Cell label="用户协议" href={AGREEMENTS.reg} />
            <Cell label="隐私政策" href={AGREEMENTS.pri} />
            <Cell label="关于我们" href="/master/about" />
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
