import type { Metadata } from 'next';
import CurrentUserLoader from '../../components/CurrentUserLoader';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminRouteGuard from '../../components/admin/AdminRouteGuard';
import AdminTopbar from '../../components/admin/AdminTopbar';

// 管理端应用外壳：顶栏（品牌 / 用户 / 退出）+ 左侧可折叠菜单 + 右侧内容区。
// 「个人中心」已从顶栏移入左侧菜单「系统设置」的第一项（见 lib/admin-menu.ts）。
export const metadata: Metadata = {
  title: '老马家电 - 运营端',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <CurrentUserLoader role="admin" />
      <AdminTopbar />
      <div className="admin-body">
        <AdminSidebar />
        <main className="admin-main">
          <div className="admin-main-inner">
            <AdminRouteGuard>{children}</AdminRouteGuard>
          </div>
        </main>
      </div>
    </div>
  );
}
