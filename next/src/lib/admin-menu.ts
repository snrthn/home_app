// 管理端左侧菜单 · 本地硬编码路由表（唯一来源）
// 改菜单结构 / 路由 / 文案，只改这里；侧边栏与占位页均从此读取。
// 节点语义：有 children ⇒ 目录（仅分组，不可点击、无对应页面）；无 children ⇒ 路由（点击跳转、有页面）。
// 目录的 path 不再绑定页面，占位页（catch-all）只服务路由路径。

export interface AdminMenuItem {
  key: string;
  label: string;
  path: string;
  icon?: string;
  children?: AdminMenuItem[];
}

export const ADMIN_MENU: AdminMenuItem[] = [
  { key: 'dashboard', label: '工作台', path: '/admin', icon: 'grid' },
  {
    key: 'users',
    label: '用户管理',
    path: '/admin/users',
    icon: 'users',
    children: [
      { key: 'admins', label: '后台账号', path: '/admin/users/admins' },
      { key: 'customers', label: '客户管理', path: '/admin/users/customers' },
      { key: 'masters', label: '师傅管理', path: '/admin/users/masters' },
      { key: 'verifications', label: '认证审核', path: '/admin/users/verifications' },
    ],
  },
  {
    key: 'settings',
    label: '系统设置',
    path: '/admin/settings',
    icon: 'gear',
    children: [
      // 个人中心是「系统设置」下的第一项（原先挂在顶栏，已移入菜单）。
      // 页面实体在 /admin/me，路径不在 /admin/settings 下不影响菜单归属与高亮。
      { key: 'me', label: '个人中心', path: '/admin/me' },
      { key: 'roles', label: '角色权限', path: '/admin/settings/roles' },
      { key: 'logs', label: '操作日志', path: '/admin/settings/logs' },
    ],
  },
  {
    key: 'services',
    label: '服务与类目',
    path: '/admin/services',
    icon: 'layers',
    children: [
      { key: 'categories', label: '服务类目', path: '/admin/services/categories' },
      { key: 'specs', label: '服务规格', path: '/admin/services/specs' },
      { key: 'areas', label: '服务区域', path: '/admin/services/areas' },
    ],
  },
  {
    key: 'dispatch',
    label: '调度派单',
    path: '/admin/dispatch',
    icon: 'truck',
    children: [
      { key: 'smart', label: '智能派单', path: '/admin/dispatch/smart' },
      { key: 'pool', label: '抢单池', path: '/admin/dispatch/pool' },
    ],
  },
  {
    key: 'orders',
    label: '订单管理',
    path: '/admin/orders',
    icon: 'doc',
    children: [
      { key: 'all', label: '全部订单', path: '/admin/orders/all' },
      { key: 'pending', label: '待接单', path: '/admin/orders/pending' },
      { key: 'active', label: '进行中', path: '/admin/orders/active' },
      { key: 'refund', label: '退款/售后', path: '/admin/orders/refund' },
    ],
  },
  {
    key: 'reviews',
    label: '评价客服',
    path: '/admin/reviews',
    icon: 'chat',
    children: [
      { key: 'ratings', label: '用户评价', path: '/admin/reviews/ratings' },
      { key: 'complaints', label: '投诉处理', path: '/admin/reviews/complaints' },
      { key: 'tickets', label: '工单管理', path: '/admin/reviews/tickets' },
    ],
  },
  {
    key: 'content',
    label: '内容管理',
    path: '/admin/content',
    icon: 'file',
    children: [
      { key: 'agreements', label: '协议条款', path: '/admin/content/agreements' },
      { key: 'notices', label: '公告通知', path: '/admin/content/notices' },
      { key: 'help', label: '帮助中心', path: '/admin/content/help' },
    ],
  },
  {
    key: 'reports',
    label: '数据报表',
    path: '/admin/reports',
    icon: 'chart',
    children: [
      { key: 'business', label: '经营报表', path: '/admin/reports/business' },
      { key: 'performance', label: '师傅绩效', path: '/admin/reports/performance' },
      { key: 'growth', label: '用户增长', path: '/admin/reports/growth' },
    ],
  },
];

// 按路径精确匹配菜单项（父级或子级均可），用于占位页取标题与高亮。
export function findMenuByPath(path: string): AdminMenuItem | null {
  for (const item of ADMIN_MENU) {
    if (item.path === path) return item;
    if (item.children) {
      const child = item.children.find((c) => c.path === path);
      if (child) return child;
    }
  }
  return null;
}
