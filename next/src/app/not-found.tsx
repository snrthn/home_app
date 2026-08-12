import NotFoundView from '@/components/NotFoundView';

export const metadata = {
  title: '页面不存在 - 老马家电',
};

// 根级 404：当访问 /foo 这类不存在的根路由时兜底。
// 默认回到用户端首页（若用户已登录，middleware 会按角色再分流）。
export default function NotFound() {
  return <NotFoundView homeHref="/client" homeLabel="返回首页" />;
}
