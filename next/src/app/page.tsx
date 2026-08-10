import { redirect } from 'next/navigation';

// 根路径：未登录用户进入登录页；已登录用户由 middleware 从 /login 重定向到对应端首页。
// 修复此前 / 缺失导致的 404 与 agreements/[code]「返回首页」死链。
export default function Home() {
  redirect('/login');
}
