'use client';

import { useUserStore } from '../lib/user-store';
import type { AppRole } from '../lib/auth';

const ROLE_LABEL: Record<AppRole, string> = {
  customer: '客户',
  master: '师傅',
  admin: '管理员',
};

// 顶栏展示当前角色的用户信息（昵称 / 手机号）。
export default function UserBadge({ role }: { role: AppRole }) {
  const user = useUserStore((s) => s.users[role]);
  const name = user?.nickname || user?.phone || '未登录';
  return (
    <span className="user-badge">
      {ROLE_LABEL[role]}：{name}
    </span>
  );
}
