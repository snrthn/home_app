'use client';
import { useState } from 'react';
import { useLogout } from '../lib/useLogout';
import { ConfirmDialog } from './ConfirmDialog';

export default function LogoutButton() {
  const logout = useLogout();
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    setOpen(false);
    // 退出会整页跳转，无需 await；logout 内部已捕获后端异常
    logout();
  };

  return (
    <>
      <button type="button" className="logout-btn" onClick={() => setOpen(true)}>
        退出
      </button>
      <ConfirmDialog
        open={open}
        title="确认退出登录？"
        message="退出后需重新登录，本端会话不会保留。"
        confirmLabel="确认退出"
        cancelLabel="取消"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
