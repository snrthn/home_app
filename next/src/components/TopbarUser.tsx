'use client';

import type { AppRole } from '../lib/auth';
import UserBadge from './UserBadge';
import LogoutButton from './LogoutButton';

// 顶栏右侧「用户 + 退出」组合，三端（client/master/admin）统一复用，消除重复。
export default function TopbarUser({ role }: { role: AppRole }) {
  return (
    <div className="topbar-right">
      <UserBadge role={role} />
      <LogoutButton />
    </div>
  );
}
