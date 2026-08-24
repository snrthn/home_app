'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PortalNavSetter } from '@/components/PortalShell';
import EmptyState from '@/components/EmptyState';
import { StatusBadge } from '@/components/admin/DataTable';
import { useCurrentUser, fetchProfile } from '@/lib/useCurrentUser';
import { getOrderPool, getMasterOrders, getMyIncomeSummary } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { useOrderSocket } from '@/lib/useOrderSocket';
import { resolveAsset } from '@/lib/api';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  type OrderStatus,
} from '@/lib/order-status';

// 师傅端首页 v2：更大气的头部 + 快捷入口 + 聚焦收入 + 精致订单卡片
// 以「接单赚钱」为核心，数据来自现有接口，保持 WS 实时刷新。

const MASTER_STATUS_LABEL: Record<string, string> = {
  pending: '资料审核中',
  active: '已通过',
  disabled: '已停用',
};

const MASTER_STATUS_TONE: Record<string, 'green' | 'orange' | 'red' | 'gray'> = {
  pending: 'orange',
  active: 'green',
  disabled: 'red',
};

// 进行中的单（师傅侧还欠动作的）：待上门 → 服务中 → 待验收
const ONGOING: OrderStatus[] = [
  'accepted',
  'departing',
  'arrived',
  'servicing',
  'pending_confirm',
];

function fmtMoney(n?: number) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return `¥${n % 1 === 0 ? n : n.toFixed(2)}`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '未约';
  return iso.slice(0, 10).replace(/-/g, '.');
}

// 内联 SVG 图标：保持跨平台一致，不引入新依赖
const Icons = {
  avatar: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ),
  pool: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
      <path d="M16 11l-4 4-4-4" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 14h.01" />
      <path d="M13 14h4" />
      <path d="M9 18h.01" />
      <path d="M13 18h4" />
    </svg>
  ),
  income: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  notice: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  ),
  arrowRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  ),
};

export default function MasterHome() {
  useCurrentUser('master');
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: QK.profile('master'),
    queryFn: fetchProfile,
  });
  const { data: income } = useQuery({
    queryKey: QK.masterIncomeSummary,
    queryFn: getMyIncomeSummary,
  });
  const { data: myOrders = [] } = useQuery({
    queryKey: QK.orderMaster,
    queryFn: () => getMasterOrders(),
  });
  const { data: pool = [] } = useQuery({
    queryKey: QK.orderPool,
    queryFn: () => getOrderPool(),
  });

  // 实时推送：新订单入池 / 订单状态变化 → 刷新首页统计
  useOrderSocket(
    {
      onNewOrder: () => qc.invalidateQueries({ queryKey: QK.orderPool }),
      onOrderUpdate: () => {
        qc.invalidateQueries({ queryKey: QK.orderPool });
        qc.invalidateQueries({ queryKey: QK.orderMaster });
      },
    },
    { pool: true },
  );

  const p = profile;
  const masterStatus: string = p?.master?.status ?? '';
  const nickname = p?.nickname || '师傅';
  const active = masterStatus === 'active';
  const avatarUrl = p?.avatar ? resolveAsset(p.avatar) : '';
  const rating = typeof p?.master?.rating === 'number' ? p.master.rating : undefined;
  const orderCount = typeof p?.master?.orderCount === 'number' ? p.master.orderCount : undefined;

  const ongoingOrders = myOrders.filter((o) => ONGOING.includes(o.status));
  const pendingConfirm = myOrders.filter((o) => o.status === 'pending_confirm').length;
  const monthCredited = income?.monthCredited;
  const available = income?.available;
  const withdrawing = income?.withdrawing;

  // 待办：进行中的单按创建时间倒序，最多 5 条
  const todoOrders = [...ongoingOrders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const quickActions = [
    {
      label: '接单池',
      href: '/master/orders/pool',
      icon: Icons.pool,
      badge: pool.length > 0 ? pool.length : undefined,
      tone: 'primary',
    },
    {
      label: '我的订单',
      href: '/master/orders/mine',
      icon: Icons.orders,
      badge: ongoingOrders.length > 0 ? ongoingOrders.length : undefined,
      tone: 'text',
    },
    {
      label: '收入明细',
      href: '/master/me/income/details',
      icon: Icons.income,
      tone: 'text',
    },
    {
      label: '平台公告',
      href: '/master/notices',
      icon: Icons.notice,
      tone: 'text',
    },
  ];

  return (
    <>
      <PortalNavSetter
        title="老马家电 · 师傅端"
        menu={[{ label: '关于我们', href: '/master/about' }]}
      />
      <div className="laoma-container master-home">
        {/* 头部个人信息区 */}
        <div className="master-home-hero">
          <div className="master-home-hero-main">
            <div className="master-home-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={nickname} />
              ) : (
                <div className="master-home-avatar-placeholder">{Icons.avatar}</div>
              )}
            </div>
            <div className="master-home-hero-info">
              <div className="master-home-name-row">
                <span className="master-home-name">{nickname}</span>
                <StatusBadge tone={MASTER_STATUS_TONE[masterStatus] ?? 'gray'}>
                  {MASTER_STATUS_LABEL[masterStatus] ?? '审核中'}
                </StatusBadge>
              </div>
              <div className="master-home-meta">
                {typeof rating === 'number' && (
                  <span className="master-home-tag">
                    <span className="master-home-star">{Icons.star}</span>
                    {rating.toFixed(1)}
                  </span>
                )}
                {typeof orderCount === 'number' && (
                  <span className="master-home-tag">累计接单 {orderCount}</span>
                )}
              </div>
            </div>
          </div>

          {/* 关键指标条：单行三列分散对齐 */}
          <div className="master-home-hero-metrics">
            <div className="master-home-hero-metric">
              <span className="master-home-hero-metric-value">{pool.length}</span>
              <span className="master-home-hero-metric-label">接单池新单</span>
            </div>
            <div className="master-home-hero-metric-divider" />
            <div className="master-home-hero-metric">
              <span className="master-home-hero-metric-value">{ongoingOrders.length}</span>
              <span className="master-home-hero-metric-label">进行中</span>
            </div>
            <div className="master-home-hero-metric-divider" />
            <div className="master-home-hero-metric">
              <span className="master-home-hero-metric-value">{pendingConfirm}</span>
              <span className="master-home-hero-metric-label">待验收</span>
            </div>
          </div>
        </div>

        {/* 可提现余额大卡 */}
        <div className="card master-home-balance">
          <div className="master-home-balance-main">
            <div className="master-home-balance-label">可提现余额</div>
            <div className="master-home-balance-amount">{fmtMoney(available)}</div>
            <div className="master-home-balance-sub">提现中 {fmtMoney(withdrawing)}</div>
          </div>
          <Link
            href="/master/me/income"
            className="btn-primary master-home-balance-btn"
            style={{ textDecoration: 'none' }}
          >
            立即提现
          </Link>
        </div>

        {/* 快捷功能 4 宫格 */}
        <div className="card master-home-quick">
          {quickActions.map((a) => (
            <Link key={a.label} href={a.href} className="master-home-quick-item" style={{ textDecoration: 'none' }}>
              <div className={`master-home-quick-icon is-${a.tone}`}>
                {a.icon}
                {a.badge !== undefined && a.badge > 0 && (
                  <span className="master-home-quick-badge">{a.badge > 99 ? '99+' : a.badge}</span>
                )}
              </div>
              <span className="master-home-quick-label">{a.label}</span>
            </Link>
          ))}
        </div>

        {/* 进行中的订单 */}
        <div className="home-section-head">
          <h3>进行中的订单</h3>
          {ongoingOrders.length > 0 && (
            <Link href="/master/orders/mine" className="home-section-more">
              查看全部（{ongoingOrders.length}）
            </Link>
          )}
        </div>
        {todoOrders.length === 0 ? (
          <div className="card master-home-empty">
            <EmptyState text="暂无进行中的订单，去接单池看看新单吧。" />
          </div>
        ) : (
          <div className="master-home-order-list">
            {todoOrders.map((o) => {
              const addr = o.address;
              const addrLine = addr
                ? [addr.province, addr.city, addr.district, addr.detail].filter(Boolean).join('')
                : '';
              return (
                <Link
                  key={o.id}
                  href={`/master/orders/${o.id}`}
                  className="card master-home-order-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="master-home-order-header">
                    <div className="master-home-order-title">{o.serviceItem?.name ?? '家政服务'}</div>
                    <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </StatusBadge>
                  </div>
                  <div className="master-home-order-row">
                    <span className="master-home-order-time">
                      <span className="master-home-order-icon">{Icons.calendar}</span>
                      预约 {fmtDate(o.appointmentDate)} {o.appointmentSlot || ''}
                    </span>
                    <span className="master-home-order-amount">¥{o.amount}</span>
                  </div>
                  {addrLine && (
                    <div className="master-home-order-address">
                      <span className="master-home-order-icon">{Icons.pin}</span>
                      {addrLine}
                    </div>
                  )}
                  <div className="master-home-order-arrow">{Icons.arrowRight}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
