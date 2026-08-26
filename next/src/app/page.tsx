import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AppRole } from '@/lib/auth';
import { ROLE_HOME } from '@/lib/route-guards';

// 根路径跳转规则：
// 1. 先查安装状态：未安装 → 跳 /install
// 2. 已安装：按权重 customer > master > admin 自动检测登录态
//    - 某角色有 token → 跳对应端首页
//    - 多个角色都登录 → 按权重优先级跳转（用户端优先）
//    - 都没登录 → 跳登录页
//
// 注意：此处只做「有没有 token」的粗判断，角色真实性由 middleware 和后端校验。
// token 无效/过期时，进入对应端后 middleware 会再踢回登录页，不会有安全问题。
const ROLE_PRIORITY: AppRole[] = ['customer', 'master', 'admin'];

// 服务端查安装状态：后端不可达时默认"已安装"，避免后端故障时卡在安装页
async function checkInstalled(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:3721/api/v1/install/status', {
      cache: 'no-store',
    });
    if (!res.ok) return true;
    const data = await res.json();
    return data.installed === true;
  } catch {
    return true;
  }
}

export default async function Home() {
  const installed = await checkInstalled();
  if (!installed) {
    redirect('/install');
  }

  const cookieStore = cookies();
  const raw = cookieStore.get('lm_tokens')?.value;

  let map: Record<string, string> = {};
  if (raw) {
    try {
      map = JSON.parse(raw) as Record<string, string>;
    } catch {
      map = {};
    }
  }

  for (const role of ROLE_PRIORITY) {
    if (map[role]) {
      redirect(ROLE_HOME[role]);
    }
  }

  redirect('/login');
}
