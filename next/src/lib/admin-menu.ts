// 管理端左侧菜单 · 本地硬编码路由表（唯一来源）
// 改菜单结构 / 路由 / 文案，只改这里；侧边栏与占位页均从此读取。
// 节点语义：有 children ⇒ 目录（仅分组，不可点击、无对应页面）；无 children ⇒ 路由（点击跳转、有页面）。
// 目录的 path 不再绑定页面，占位页（catch-all）只服务路由路径。
//
// perm：该节点所需权限码（resource:action）。与 nest/src/rbac/function-points.ts 的菜单级 perm 对齐。
//   - 未声明 perm（undefined）⇒ 始终可见（如工作台、个人中心这类“自身空间”入口）。
//   - 目录节点本身不声明 perm，是否可见由其【子节点过滤后是否为空】决定。
// 前端 AdminSidebar 据此按当前账号权限动态过滤菜单。

export interface AdminMenuItem {
  key: string;
  label: string;
  path: string;
  icon?: string;
  perm?: string;
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
      { key: 'admins', label: '后台账号', path: '/admin/users/admins', perm: 'users:admin_read' },
      { key: 'customers', label: '客户管理', path: '/admin/users/customers', perm: 'users:customer_read' },
      { key: 'masters', label: '师傅管理', path: '/admin/users/masters', perm: 'users:master_read' },
      { key: 'verifications', label: '认证审核', path: '/admin/users/verifications', perm: 'users:verify' },
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
      // 个人中心属“自身空间”，无权限约束、始终可见。
      { key: 'me', label: '个人中心', path: '/admin/me' },
      { key: 'global', label: '全局配置', path: '/admin/settings/global' },
      { key: 'payment', label: '支付配置', path: '/admin/settings/payment' },
      { key: 'roles', label: '角色权限', path: '/admin/settings/roles', perm: 'settings:role_manage' },
      { key: 'logs', label: '操作日志', path: '/admin/settings/logs', perm: 'logs:view' },
    ],
  },
  {
    key: 'services',
    label: '服务与类目',
    path: '/admin/services',
    icon: 'layers',
    children: [
      { key: 'categories', label: '服务类目', path: '/admin/services/categories', perm: 'services:category_manage' },
      { key: 'items', label: '服务项目', path: '/admin/services/items', perm: 'services:item_manage' },
      { key: 'areas', label: '服务区域', path: '/admin/services/areas', perm: 'services:area_manage' },
    ],
  },
  {
    key: 'dispatch',
    label: '调度派单',
    path: '/admin/dispatch',
    icon: 'truck',
    children: [
      { key: 'smart', label: '智能派单', path: '/admin/dispatch/smart', perm: 'dispatch:smart' },
    ],
  },
  {
    key: 'orders',
    label: '订单管理',
    path: '/admin/orders',
    icon: 'doc',
    children: [
      { key: 'all', label: '全部订单', path: '/admin/orders/all', perm: 'orders:read' },
      { key: 'pending', label: '待接订单', path: '/admin/orders/pending', perm: 'orders:read' },
      { key: 'active', label: '正在服务', path: '/admin/orders/active', perm: 'orders:read' },
      { key: 'refund', label: '退款/售后', path: '/admin/orders/refund', perm: 'orders:refund' },
      { key: 'aftersale', label: '售后工作台', path: '/admin/aftersale', perm: 'orders:refund' },
    ],
  },
  {
    key: 'finance',
    label: '财务结算',
    path: '/admin/settlements',
    icon: 'wallet',
    children: [
      { key: 'settlements', label: '结算台账', path: '/admin/settlements', perm: 'orders:read' },
      { key: 'withdrawals', label: '提现管理', path: '/admin/withdrawals', perm: 'finance:manage' },
      { key: 'commission', label: '分账规则', path: '/admin/finance/commission', perm: 'finance:manage' },
    ],
  },
  {
    key: 'reviews',
    label: '评价客服',
    path: '/admin/reviews',
    icon: 'chat',
    children: [
      { key: 'ratings', label: '用户评价', path: '/admin/reviews/ratings', perm: 'reviews:read' },
      { key: 'complaints', label: '投诉处理', path: '/admin/reviews/complaints', perm: 'complaints:handle' },
      { key: 'tickets', label: '工单管理', path: '/admin/reviews/tickets', perm: 'tickets:manage' },
    ],
  },
  {
    key: 'content',
    label: '内容管理',
    path: '/admin/content',
    icon: 'file',
    children: [
      { key: 'agreements', label: '协议条款', path: '/admin/content/agreements', perm: 'content:manage' },
      { key: 'notices', label: '公告通知', path: '/admin/content/notices', perm: 'content:manage' },
      { key: 'help', label: '帮助中心', path: '/admin/content/help', perm: 'content:manage' },
    ],
  },
  {
    key: 'reports',
    label: '数据报表',
    path: '/admin/reports',
    icon: 'chart',
    children: [
      { key: 'business', label: '经营报表', path: '/admin/reports/business', perm: 'reports:view' },
      { key: 'performance', label: '师傅绩效', path: '/admin/reports/performance', perm: 'reports:view' },
      { key: 'growth', label: '用户增长', path: '/admin/reports/growth', perm: 'reports:view' },
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

// 根据访问路径推导该路由「所需权限码」。供前端路由守卫与 middleware 共用，单一数据源。
// - 无 perm 约束的节点（工作台 /admin、个人中心 /admin/me、各目录）→ 返回 null（放行）。
// - 采用「最长前缀匹配」：精确命中优先，否则取路径为 pathname 前缀、且 perm 路径最长的节点。
//   这样 /admin/settings/roles 命中 settings:role_manage；其下潜在子路径也继承该 perm。
// 与后端 @RequirePerm 的权限码同源（function-points.ts），改菜单权限只改此处 + 后端装饰器。
export function findMenuPerm(pathname: string): string | null {
  let bestPerm: string | null = null;
  let bestLen = -1;
  const consider = (item: AdminMenuItem) => {
    if (!item.perm) return; // 无 perm 的节点不提供权限约束
    const exact = pathname === item.path;
    const prefix = pathname.startsWith(item.path + '/');
    if ((exact || prefix) && item.path.length > bestLen) {
      bestLen = item.path.length;
      bestPerm = item.perm;
    }
  };
  for (const item of ADMIN_MENU) {
    consider(item);
    if (item.children) item.children.forEach(consider);
  }
  return bestPerm;
}
