'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ADMIN_MENU } from '@/lib/admin-menu';
import { Icon } from './admin-icons';

const EXPANDED_KEY = 'admin_sidebar_expanded';

// 管理端左侧菜单：整栏可折叠为图标态；带子项的模块为手风琴（整行点击展开/收起，箭头同效）。
// 节点分两类：目录（有 children，整行点击控制开合、无页面不跳转）；路由（叶子，点击跳转）。
// 整栏默认折叠（按需求）；仅当用户曾显式展开（存 '1'）才记住展开，其余一律默认折叠。
// 找出当前路由所属的父分组 key（用于默认展开“所在分组”的二级菜单）
function findActiveParentKey(pathname: string): string | undefined {
  return ADMIN_MENU.find((m) => m.children?.some((c) => pathname.startsWith(c.path)))?.key;
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  // 二级（子）菜单默认全部收起；仅当前所在分组的子菜单默认展开。
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    if (localStorage.getItem(EXPANDED_KEY) === '1') setCollapsed(false);
  }, []);

  // 进入页面时，自动展开当前路由所属的分组（其余默认收起）。
  useEffect(() => {
    const parent = findActiveParentKey(pathname);
    if (parent && !openKeys.includes(parent)) setOpenKeys((prev) => [...prev, parent]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(EXPANDED_KEY, next ? '0' : '1');
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setOpenKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // 高亮匹配：/'admin' 是根路由（工作台），必须用精确匹配，否则会命中所有 /admin/* 页面而恒亮；
  // 其余路由用「精确 || 以 path/ 开头」即可正确命中其子页面。
  const isActive = (p: string) =>
    p === '/admin'
      ? pathname === '/admin'
      : pathname === p || pathname.startsWith(p + '/');

  return (
    <aside className={`admin-sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="admin-sidebar-head">
        {!collapsed && <span className="admin-sidebar-title">管理菜单</span>}
        <button
          type="button"
          className="admin-collapse-btn"
          onClick={toggleCollapsed}
          aria-label={collapsed ? '展开菜单' : '折叠菜单'}
          title={collapsed ? '展开菜单' : '折叠菜单'}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
        </button>
      </div>

      <nav className="admin-nav">
        {ADMIN_MENU.map((item) => {
          const isDir = !!item.children?.length;
          const open = openKeys.includes(item.key);
          // 目录：无页面，整行不跳转；路由：可点击跳转。
          // 高亮规则：路由自身匹配则高亮；目录在其某个子路由激活时高亮。
          const itemActive = isDir
            ? item.children!.some((c) => isActive(c.path))
            : isActive(item.path);
          const rowClass = `admin-nav-item${itemActive ? ' active' : ''}${isDir ? ' is-dir' : ''}`;
          const rowInner = (
            <>
              <span className="nav-icon">
                <Icon name={item.icon || 'dot'} />
              </span>
              <span className="label">{item.label}</span>
              {isDir && (
                <button
                  type="button"
                  className={`nav-caret${open ? ' open' : ''}`}
                  aria-label={open ? '收起' : '展开'}
                  onClick={(e) => {
                    // 仅控制展开/收起，目录整行无跳转行为
                    e.preventDefault();
                    e.stopPropagation();
                    toggleGroup(item.key);
                  }}
                >
                  <Icon name="chevron-right" size={14} />
                </button>
              )}
            </>
          );
          return (
            <div className="admin-nav-group" key={item.key}>
              {isDir ? (
                <div
                  className={rowClass}
                  title={collapsed ? item.label : undefined}
                  onClick={() => toggleGroup(item.key)}
                >
                  {rowInner}
                </div>
              ) : (
                <Link
                  href={item.path}
                  className={rowClass}
                  title={collapsed ? item.label : undefined}
                >
                  {rowInner}
                </Link>
              )}

              {isDir && open && !collapsed && (
                <div className="admin-nav-children">
                  {item.children!.map((child) => (
                    <Link
                      key={child.key}
                      href={child.path}
                      className={`admin-nav-child${isActive(child.path) ? ' active' : ''}`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
