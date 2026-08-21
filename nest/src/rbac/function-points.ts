/**
 * 功能点注册表（代码层，非 DB）。
 * 一个功能点 = 一个菜单路由 / 按钮 / API 接口；它声明自己需要哪个权限码（perm）。
 * 后端按角色的权限码集合反查"该角色覆盖了哪些功能点"（getRoleFunctions）。
 * 前端 P3 会维护自己的 FUNCTION_POINTS 副本用于菜单/按钮过滤，二者以同一套 perm 码对齐。
 *
 * 来源：docs/rbac-design.md §4 权限码表。此处登记菜单级 + 少量高风险按钮/接口级功能点。
 */
export interface FunctionPoint {
  code: string; // 功能点唯一 id
  label: string; // 展示名
  perm: string; // 所需权限码（resource:action）
  type: 'menu' | 'button' | 'api';
  path?: string; // 菜单/接口路径
}

export const FUNCTION_POINTS: FunctionPoint[] = [
  // 用户管理
  { code: 'menu:users:admins', label: '后台账号', perm: 'users:admin_read', type: 'menu', path: '/admin/users/admins' },
  { code: 'btn:users:admins:manage', label: '后台账号·新增/编辑/启停', perm: 'users:admin_manage', type: 'button' },
  { code: 'menu:users:customers', label: '客户管理', perm: 'users:customer_read', type: 'menu', path: '/admin/users/customers' },
  { code: 'btn:users:customers:toggle', label: '客户·启停', perm: 'users:customer_toggle', type: 'button' },
  { code: 'menu:users:masters', label: '师傅管理', perm: 'users:master_read', type: 'menu', path: '/admin/users/masters' },
  { code: 'btn:users:masters:toggle', label: '师傅·启停', perm: 'users:master_toggle', type: 'button' },
  { code: 'btn:users:masters:verify', label: '师傅·审核', perm: 'users:master_verify', type: 'button' },
  { code: 'menu:users:verifications', label: '认证审核', perm: 'users:verify', type: 'menu', path: '/admin/users/verifications' },
  // 服务与类目
  { code: 'menu:services:categories', label: '服务类目', perm: 'services:category_manage', type: 'menu', path: '/admin/services/categories' },
  { code: 'menu:services:items', label: '服务项目', perm: 'services:item_manage', type: 'menu', path: '/admin/services/items' },
  { code: 'menu:services:areas', label: '服务区域', perm: 'services:area_manage', type: 'menu', path: '/admin/services/areas' },
  // 调度派单
  { code: 'menu:dispatch:smart', label: '智能派单', perm: 'dispatch:smart', type: 'menu', path: '/admin/dispatch/smart' },
  // 订单管理
  { code: 'menu:orders', label: '订单管理', perm: 'orders:read', type: 'menu', path: '/admin/orders' },
  { code: 'btn:orders:edit', label: '订单·状态变更', perm: 'orders:edit', type: 'button' },
  { code: 'btn:orders:refund', label: '退款/售后', perm: 'orders:refund', type: 'button', path: '/admin/orders/refund' },
  // 财务结算（补偿入账审核 + 提现审核打款）
  { code: 'menu:finance:settlements', label: '结算台账', perm: 'orders:read', type: 'menu', path: '/admin/settlements' },
  { code: 'btn:finance:settle', label: '补偿单·入账/驳回', perm: 'finance:manage', type: 'button' },
  { code: 'menu:finance:withdrawals', label: '提现管理', perm: 'finance:manage', type: 'menu', path: '/admin/withdrawals' },
  { code: 'btn:finance:withdraw_pay', label: '提现·打款/驳回', perm: 'finance:manage', type: 'button' },
  // 评价客服
  { code: 'menu:reviews:ratings', label: '用户评价', perm: 'reviews:read', type: 'menu', path: '/admin/reviews/ratings' },
  { code: 'btn:reviews:moderate', label: '评价·处置', perm: 'reviews:moderate', type: 'button' },
  { code: 'menu:reviews:complaints', label: '投诉处理', perm: 'complaints:handle', type: 'menu', path: '/admin/reviews/complaints' },
  { code: 'menu:reviews:tickets', label: '工单管理', perm: 'tickets:manage', type: 'menu', path: '/admin/reviews/tickets' },
  // 内容管理
  { code: 'menu:content', label: '协议/公告/帮助', perm: 'content:manage', type: 'menu', path: '/admin/content' },
  // 数据报表
  { code: 'menu:reports', label: '经营/绩效/增长', perm: 'reports:view', type: 'menu', path: '/admin/reports' },
  // 系统设置
  { code: 'menu:settings:roles', label: '角色权限', perm: 'settings:role_manage', type: 'menu', path: '/admin/settings/roles' },
  { code: 'menu:settings:logs', label: '操作日志', perm: 'logs:view', type: 'menu', path: '/admin/settings/logs' },
];
