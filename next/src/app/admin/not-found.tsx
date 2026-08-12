import NotFoundView from '@/components/NotFoundView';

export const metadata = {
  title: '页面不存在 - 老马家电运营端',
};

// 管理端 404：渲染在 admin layout 内（保留顶栏与左侧菜单）。
export default function NotFound() {
  return (
    <NotFoundView
      role="admin"
      title="页面不存在"
      subtitle="你访问的管理后台页面不存在或已被移除。"
      homeHref="/admin"
      homeLabel="返回工作台"
    />
  );
}
