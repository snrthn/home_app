import NotFoundView from '@/components/NotFoundView';
import { PortalNavSetter } from '@/components/PortalShell';

export const metadata = {
  title: '页面不存在 - 老马家电师傅端',
};

// 师傅端 404：渲染在 PortalShell 内，顶部显示返回按钮。
export default function NotFound() {
  return (
    <>
      <PortalNavSetter title="页面不存在" showBack backHref="/master" />
      <NotFoundView
        title="页面走丢了"
        homeHref="/master"
        homeLabel="返回首页"
      />
    </>
  );
}
