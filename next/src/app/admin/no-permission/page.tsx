import NoPermission from '@/components/admin/NoPermission';

export const metadata = {
  title: '无访问权限 - 老马家电运营端',
};

// 无权限兜底页：middleware（B 方案）拦截无权限访问时的重定向落点。
// 该路径不在 ADMIN_MENU 中，findMenuPerm 返回 null，middleware 不会二次拦截，无重定向循环。
export default function NoPermissionPage() {
  return <NoPermission />;
}
