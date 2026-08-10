'use client';

import { useCurrentUser } from '../lib/useCurrentUser';
import type { AppRole } from '../lib/auth';

// 放进各 portal layout，仅用于触发"查询并缓存当前用户信息"的副作用，自身不渲染任何内容。
export default function CurrentUserLoader({ role }: { role: AppRole }) {
  useCurrentUser(role);
  return null;
}
