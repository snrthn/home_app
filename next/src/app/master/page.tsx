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
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  type OrderStatus,
} from '@/lib/order-status';

// 师傅端首页：以「接单赚钱」为核心——接单池新单、进行中订单、收入一眼可见，
// 待办订单直达成行，数据来自现有接口（profile / orders / pool / income summary）。

const MASTER_STATUS_LABEL: Record<string, string> = {
  pending: '资料审核中',
  active: '已通过',
  disabled: '已停用',
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

  const p = profile as any;
  const masterStatus: string = p?.master?.status ?? '';
  const nickname = p?.nickname || '师傅';
  const active = masterStatus === 'active';

  const ongoingOrders = myOrders.filter((o) => ONGOING.includes(o.status));
  const pendingConfirm = myOrders.filter((o) => o.status === 'pending_confirm').length;
  const monthCredited = income?.monthCredited;
  const available = income?.available;
  const withdrawing = income?.withdrawing;

  // 待办：进行中的单按创建时间倒序，最多 5 条
  const todoOrders = [...ongoingOrders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <>
      <PortalNavSetter
        title="老马家电 · 师傅端"
        menu={[{ label: '关于我们', href: '/master/about' }]}
      />
      <div className="laoma-container home-gap">
        {/* 欢迎卡 + 审核状态 */}
        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>你好，{nickname}</h2>
          {active ? (
            <p style={{ margin: 0, color: 'var(--color-text-soft)' }}>
              接单赚钱，从接单池开始。
            </p>
          ) : (
            <p style={{ margin: 0, color: 'var(--color-text-soft)' }}>
              {MASTER_STATUS_LABEL[masterStatus] ?? '资料审核中'}
              {masterStatus === 'pending' ? '，通过后即可开始接单。' : '，暂时无法接单。'}
            </p>
          )}
        </div>

        {/* 数据概览 */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="home-stats">
            <Link href="/master/orders/pool" className="home-stat" style={{ textDecoration: 'none' }}>
              <span className="home-stat-value is-primary">{pool.length}</span>
              <span className="home-stat-label">接单池新单</span>
            </Link>
            <Link href="/master/orders/mine" className="home-stat" style={{ textDecoration: 'none' }}>
              <span className="home-stat-value">{ongoingOrders.length}</span>
              <span className="home-stat-label">进行中</span>
            </Link>
            <Link href="/master/orders/mine" className="home-stat" style={{ textDecoration: 'none' }}>
              <span className="home-stat-value">{pendingConfirm}</span>
              <span className="home-stat-label">待验收</span>
            </Link>
            <Link href="/master/me/income" className="home-stat" style={{ textDecoration: 'none' }}>
              <span className="home-stat-value">{fmtMoney(monthCredited)}</span>
              <span className="home-stat-label">本月入账</span>
            </Link>
          </div>
        </div>

        {/* 收入卡 */}
        <div className="card home-income">
          <div className="home-income-main">
            <span className="home-income-sub">可提现余额</span>
            <span className="home-income-amount">{fmtMoney(available)}</span>
            <span className="home-income-sub">
              提现中 {fmtMoney(withdrawing)}
            </span>
          </div>
          <Link href="/master/me/income" className="btn-primary" style={{ textDecoration: 'none' }}>
            去提现
          </Link>
        </div>

        {/* 今日待办：进行中的订单 */}
        <div className="home-section-head">
          <h3>进行中的订单</h3>
          {ongoingOrders.length > 0 && (
            <Link href="/master/orders/mine" className="home-section-more">
              查看全部（{ongoingOrders.length}）
            </Link>
          )}
        </div>
        {todoOrders.length === 0 ? (
          <div className="card">
            <EmptyState text="暂无进行中的订单，去接单池看看新单吧。" />
          </div>
        ) : (
          <div className="order-grid">
            {todoOrders.map((o) => {
              const addr = o.address;
              const addrLine = addr
                ? [addr.province, addr.city, addr.district, addr.detail].filter(Boolean).join('')
                : '';
              return (
                <Link
                  key={o.id}
                  href={`/master/orders/${o.id}`}
                  className="card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{o.serviceItem?.name ?? '家政服务'}</div>
                    <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </StatusBadge>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: 'var(--color-text-soft)', fontSize: 13 }}>
                    <span>预约 {o.appointmentDate?.slice(0, 10) || '未约'}</span>
                    <span style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}>¥{o.amount}</span>
                  </div>
                  {addrLine && (
                    <div style={{ marginTop: 4, color: 'var(--color-muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📍 {addrLine}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
