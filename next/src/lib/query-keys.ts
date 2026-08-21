// react-query 的 queryKey 唯一来源。
// 集中定义的意义：同一份数据在不同组件里必须用「同一个 key」，
// react-query 才能把并发/重复的请求合并成一次（这是修掉「页面初始化请求两次」的前提）。
// 例如 /auth/profile 会被 layout 的 CurrentUserLoader 与个人中心页同时需要，
// 两处都用 QK.profile，最终只发一次请求。
import type { AppRole } from './auth';

export const QK = {
  // 当前登录用户资料（/auth/profile）—— 按角色分 key，避免跨角色串缓存 / 命中旧缓存
  profile: (role: AppRole) => ['auth', 'profile', role] as const,
  // 管理端列表
  adminAdmins: ['admin', 'admins'] as const,
  adminCustomers: ['admin', 'customers'] as const,
  adminMasters: ['admin', 'masters'] as const,
  adminPendingMasters: ['admin', 'masters', 'pending'] as const,
  adminAgreements: ['admin', 'agreements'] as const,
  adminNotices: ['admin', 'notices'] as const,
  adminServiceCategories: ['admin', 'services', 'categories'] as const,
  adminServiceItems: ['admin', 'services', 'items'] as const,
  adminServiceAreas: ['admin', 'services', 'areas'] as const,
  publicNotices: (scope: string) => ['public', 'notices', scope] as const,
  siteContent: (key: string) => ['site-content', key] as const,
  adminSiteContent: (key: string) => ['admin', 'site-content', key] as const,
  // RBAC 角色权限
  rbacRoles: ['rbac', 'roles'] as const,
  rbacPermissions: ['rbac', 'permissions'] as const,
  rbacRole: (id: string) => ['rbac', 'roles', id] as const,
  // 支付配置（商户信息 / 一键接入）
  paymentConfig: ['admin', 'payment-config'] as const,
  // 订单全流程（客户 / 师傅 / 管理 共用，按场景分 key）
  orderMine: ['orders', 'mine'] as const,
  orderPool: ['orders', 'pool'] as const,
  orderMaster: ['orders', 'master'] as const,
  orderAll: ['orders', 'all'] as const,
  settlements: ['admin', 'settlements'] as const,
  // 师傅端收入 / 提现
  masterIncomeSummary: ['master', 'income', 'summary'] as const,
  masterIncomeDetails: ['master', 'income', 'details'] as const,
  masterWithdrawals: ['master', 'withdrawals'] as const,
  // 管理端提现审核
  adminWithdrawals: ['admin', 'withdrawals'] as const,
  // 分账规则配置
  commissionRules: ['admin', 'commission', 'rules'] as const,
  adminReviews: ['admin', 'reviews'] as const,
  myAddresses: ['client', 'addresses'] as const,
  publicServices: ['public', 'services'] as const,
  // 全局配置（系统设置 - 全局配置）
  globalConfig: ['global', 'config'] as const,
  // 工作台聚合统计
  dashboard: ['admin', 'dashboard'] as const,
  // 数据报表（经营 / 绩效 / 增长，维度作为二级 key）
  reportBusiness: ['reports', 'business'] as const,
  reportPerformance: ['reports', 'performance'] as const,
  reportGrowth: ['reports', 'growth'] as const,
  // 智能派单：看板统计
  dispatchStats: ['dispatch', 'stats'] as const,
} as const;
