'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUserStore } from '@/lib/user-store';
import { useAdminPerms } from '@/lib/usePerm';
import { useLogout } from '@/lib/useLogout';
import { ADMIN_MENU } from '@/lib/admin-menu';
import { resolveAsset } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';

// 与左侧菜单同源：取「系统设置」分组（个人中心 / 全局配置 / 支付配置 / 角色权限 / 操作日志）。
// 复制一份到右上角头像下拉，避免管理员必须展开左侧栏才能访问系统设置。
const SETTINGS = ADMIN_MENU.find((m) => m.key === 'settings')?.children ?? [];

export default function AdminUserMenu() {
  const user = useUserStore((s) => s.users.admin);
  const { can } = useAdminPerms();
  const logout = useLogout();

  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部 / Esc 关闭下拉（标准 dropdown 行为，非 modal 遮罩）
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const avatarUrl = user?.avatar ? resolveAsset(user.avatar) : '';
  const display = user?.nickname || user?.phone || '管';
  const initial = display.charAt(0);
  const visibleItems = SETTINGS.filter((c) => can(c.perm));

  const handleLogout = () => {
    setOpen(false);
    setLogoutOpen(true);
  };
  const confirmLogout = () => {
    setLogoutOpen(false);
    logout();
  };

  return (
    <>
      <div className="admin-user-menu" ref={ref}>
        <button
          type="button"
          className="admin-user-avatar"
          onClick={() => setOpen((v) => !v)}
          aria-label="用户菜单"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <span className="admin-user-initial">{initial}</span>
          )}
        </button>

        {open && (
          <div className="admin-user-dropdown" role="menu">
            <div className="admin-user-dropdown-head">
              <div className="admin-user-dropdown-name">{display}</div>
              {user?.phone && <div className="admin-user-dropdown-sub">{user.phone}</div>}
            </div>
            {visibleItems.map((item) => (
              <Link
                key={item.key}
                href={item.path}
                className="admin-user-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="admin-user-divider" />
            <button
              type="button"
              className="admin-user-item admin-user-item-danger"
              role="menuitem"
              onClick={handleLogout}
            >
              退出登录
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="确认退出登录？"
        message="退出后需重新登录，本端会话不会保留。"
        confirmLabel="确认退出"
        cancelLabel="取消"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutOpen(false)}
      />
    </>
  );
}
