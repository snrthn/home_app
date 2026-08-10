import Link from 'next/link';
import { redirect } from 'next/navigation';
import { findMenuByPath } from '@/lib/admin-menu';

// 管理端占位页（catch-all）：覆盖菜单表中所有未在别处单独实现的【路由】子页面。
// 目录节点（有 children）没有页面：直接转发到其首个子路由（真实页面）。
// 标题按路径从 admin-menu 路由表查得；后续填充真实功能时，只需在对应路径放一个
// page.tsx（静态路由优先级高于 catch-all）即可覆盖本占位。
export default function AdminPlaceholder({
  params,
}: {
  params: { slug?: string[] };
}) {
  const slug = params.slug ?? [];
  const path = '/admin/' + slug.join('/');
  const item = findMenuByPath(path);

  // 目录节点不渲染页面 → 转发到首个子路由
  if (item?.children?.length) {
    redirect(item.children[0].path);
  }
  // 未匹配任何菜单项 → 回工作台
  if (!item) {
    redirect('/admin');
  }

  const title = item.label;

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{title}（占位）</h2>
      <p>该模块页面骨架已预留，业务功能后续填充。</p>
      <p style={{ color: 'var(--color-text-soft)' }}>路径：{path}</p>
      <Link href="/admin" className="back-link">
        返回工作台
      </Link>
    </div>
  );
}
