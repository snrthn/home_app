'use client';

import { PortalNavSetter } from '@/components/PortalShell';
import { useParams, useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOrderPool,
  getMasterOrders,
  grabOrder,
  departOrder,
  arriveOrder,
  startOrder,
  completeOrder,
  getSettlementsByOrder,
  type OrderLite,
} from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg, resolveAsset } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/order-status';
import { StatusBadge } from '@/components/admin/DataTable';
import { CopyButton } from '@/components/CopyText';
import { formatDateTime } from '@/lib/format';
import EmptyState from '@/components/EmptyState';
import { useOrderSocket } from '@/lib/useOrderSocket';

// 合并接单池与我的订单：被我抢到的订单会同时出现在两处，按 id 去重（以我的那份为准，含 master 字段）
function combine(pool: OrderLite[] = [], mine: OrderLite[] = []): OrderLite[] {
  const map = new Map<string, OrderLite>();
  [...pool, ...mine].forEach((o) => map.set(o.id, o));
  return [...map.values()];
}

export default function MasterOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [grabOpen, setGrabOpen] = useState(false);
  const [departOpen, setDepartOpen] = useState(false);
  const [arriveOpen, setArriveOpen] = useState(false);
  const [arriveDigits, setArriveDigits] = useState<string[]>(Array(6).fill(''));
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [arriving, setArriving] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const poolQ = useQuery({
    queryKey: QK.orderPool,
    queryFn: () => getOrderPool(),
    refetchOnMount: 'always',
  });
  const mineQ = useQuery({
    queryKey: QK.orderMaster,
    queryFn: () => getMasterOrders(),
    refetchOnMount: 'always',
  });

  const isLoading = poolQ.isLoading || mineQ.isLoading;
  const order = combine(poolQ.data, mineQ.data).find((o) => o.id === id);

  // 退款补偿说明（按订单查结算单，含退款补偿单）
  const { data: settlements = [] } = useQuery({
    queryKey: ['settlementsByOrder', id],
    queryFn: () => getSettlementsByOrder(id),
    refetchOnMount: 'always',
  });
  const compensation = settlements.find((s) => s.type === 'compensation') ?? null;
  const normalSettlement = settlements.find((s) => s.type === 'normal') ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: QK.orderPool });
    qc.invalidateQueries({ queryKey: QK.orderMaster });
    // 退款/补偿结算单是独立查询，流转（取消→退款→生成补偿单）后必须一并刷新，
    // 否则 compensation 仍为 null，会错误显示「全额退款·本单未产生收入」兜底文案
    qc.invalidateQueries({ queryKey: ['settlementsByOrder', id] });
  };
  const refreshMenu = [{ label: '刷新数据', onClick: refresh }];

  // 实时推送：客户支付/取消/验收/评价等流转时，本单自动刷新
  useOrderSocket(
    {
      onOrderUpdate: (o: any) => {
        if (o?.id === id) refresh();
      },
    },
    { orderId: id },
  );

  const openMap = (addr: string) => {
    const url = `https://api.map.baidu.com/geocoder?address=${encodeURIComponent(addr)}&output=html&src=webapp.baidu.openAPIdemo`;
    window.open(url, '_blank');
  };

  const onGrab = async () => {
    try {
      await grabOrder(id);
      toast.success('抢单成功，请尽快联系客户');
      refresh();
      router.push('/master/orders/mine');
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      refresh(); // 手慢了或被接走，刷新状态
    }
  };
  const onDepart = async () => {
    try {
      await departOrder(id);
      toast.success('已确认出发，请尽快到达客户地址');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };
  const arriveCodeStr = arriveDigits.join('');
  const onArrive = async () => {
    if (arriveCodeStr.length !== 6) return;
    setArriving(true);
    try {
      await arriveOrder(id, arriveCodeStr);
      toast.success('已确认到达，可开始服务');
      setArriveOpen(false);
      setArriveDigits(Array(6).fill(''));
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setArriving(false);
    }
  };
  // 6 框输入：输入数字自动跳下一格（支持一次粘贴多位），退格在空格时回退上一格
  const onDigitChange = (idx: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      setArriveDigits((prev) => prev.map((d, i) => (i === idx ? '' : d)));
      return;
    }
    setArriveDigits((prev) => {
      const next = [...prev];
      for (let k = 0; k < digits.length && idx + k < 6; k += 1) next[idx + k] = digits[k];
      return next;
    });
    codeRefs.current[Math.min(idx + digits.length, 5)]?.focus();
  };
  const onDigitKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !arriveDigits[idx] && idx > 0) {
      e.preventDefault();
      setArriveDigits((prev) => prev.map((d, i) => (i === idx - 1 ? '' : d)));
      codeRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter' && arriveCodeStr.length === 6) onArrive();
  };
  const onStart = async () => {
    try {
      await startOrder(id);
      toast.success('已开始服务');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };
  const onComplete = async () => {
    try {
      await completeOrder(id);
      toast.success('服务已完成，等待客户验收');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };

  if (isLoading) {
    return (
      <>
        <PortalNavSetter
          title="订单详情"
          showBack
          backHref="/master/orders/pool"
          menu={refreshMenu}
          onBack={() => {
            if (window.history.length > 1) router.back();
            else router.push('/master/orders/pool');
          }}
        />
        <div className="laoma-container order-mod">
          <p className="field-hint">加载中…</p>
        </div>
      </>
    );
  }
  if (!order) {
    return (
      <>
        <PortalNavSetter
          title="订单详情"
          showBack
          backHref="/master/orders/pool"
          menu={refreshMenu}
          onBack={() => {
            if (window.history.length > 1) router.back();
            else router.push('/master/orders/pool');
          }}
        />
        <div className="laoma-container order-mod">
          <div className="card">
            <EmptyState text="未找到该订单，可能已被他人接走。" />
          </div>
        </div>
      </>
    );
  }

  const isPoolOrder = order.status === 'pending_accept' && !order.master;
  const backHref = isPoolOrder ? '/master/orders/pool' : '/master/orders/mine';
  const addr = order.address;
  const addrLine = addr
    ? [addr.province, addr.city, addr.district, addr.detail].filter(Boolean).join('')
    : '-';

  return (
    <>
      <PortalNavSetter
        title="订单详情"
        showBack
        backHref={backHref}
        menu={refreshMenu}
        onBack={() => {
          if (window.history.length > 1) router.back();
          else router.push(backHref);
        }}
      />
      <div className="laoma-container">
        {/* 服务详情 */}
        <div className="card">
          <div style={{ display: 'flex', gap: 12 }}>
            {order.serviceItem?.coverImage ? (
              <img
                src={resolveAsset(order.serviceItem.coverImage)}
                alt=""
                style={{
                  width: 84,
                  height: 84,
                  objectFit: 'cover',
                  borderRadius: 'var(--radius)',
                  flex: '0 0 auto',
                }}
              />
            ) : (
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 'var(--radius)',
                  background: '#f2f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-muted)',
                  fontSize: 12,
                  flex: '0 0 auto',
                }}
              >
                暂无图片
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>{order.serviceItem?.name ?? '家政服务'}</h2>
                <StatusBadge tone={ORDER_STATUS_TONE[order.status]}>
                  {ORDER_STATUS_LABEL[order.status]}
                </StatusBadge>
              </div>
              <p className="field-hint" style={{ marginTop: 4 }}>单号 {order.orderNo}<CopyButton value={order.orderNo} title="复制订单号" /></p>
              <div className="field-inline-row" style={{ marginTop: 6 }}>
                <span className="field-label">服务单价</span>
                <span className="field-inline-value" style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}>
                  ¥{order.serviceItem?.price ?? order.amount}
                  {order.serviceItem?.unit ? `/${order.serviceItem.unit}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 订单信息 */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="field-inline-row">
            <span className="field-label">下单时间</span>
            <span className="field-inline-value">{formatDateTime(order.createdAt)}</span>
          </div>
          <div className="field-inline-row">
            <span className="field-label">订单金额</span>
            <span className="field-inline-value" style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}>
              ¥{order.amount}
            </span>
          </div>
          <div className="field-inline-row">
            <span className="field-label">服务地址</span>
            <span
              className="field-inline-value"
              role="button"
              tabIndex={0}
              onClick={() => addrLine !== '-' && openMap(addrLine)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  addrLine !== '-' && openMap(addrLine);
                }
              }}
              style={{ color: 'var(--color-primary)', cursor: 'pointer' }}
            >
              {addrLine}
            </span>
          </div>
          <div className="field-inline-row">
            <span className="field-label">联系人</span>
            <span className="field-inline-value">{addr?.contactName ?? '-'}</span>
          </div>
          <div className="field-inline-row">
            <span className="field-label">联系电话</span>
            <span className="field-inline-value">
              {addr?.contactPhone ? (
                <a href={`tel:${addr.contactPhone}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                  {addr.contactPhone}
                </a>
              ) : (
                '-'
              )}
            </span>
          </div>
          <div className="field-inline-row">
            <span className="field-label">预约时间</span>
            <span className="field-inline-value">
              {[order.appointmentDate?.slice(0, 10), order.appointmentSlot].filter(Boolean).join(' ') || '-'}
            </span>
          </div>
          {order.remark && (
            <div className="field-inline-row">
              <span className="field-label">备注</span>
              <span className="field-inline-value">{order.remark}</span>
            </div>
          )}
          {order.cancelReason && (
            <div className="field-inline-row">
              <span className="field-label">取消原因</span>
              <span className="field-inline-value">{order.cancelReason}</span>
            </div>
          )}
          {compensation && (
            <div className="field-inline-row">
              <span className="field-label">退款补偿</span>
              <span className="field-inline-value">
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>¥{compensation.masterAmount}</span>
                {' · '}
                <span
                  style={{
                    color:
                      compensation.status === 'pending'
                        ? 'var(--color-warning)'
                        : compensation.status === 'credited'
                          ? 'var(--color-success)'
                          : 'var(--color-danger)',
                  }}
                >
                  {compensation.status === 'pending'
                    ? '待平台审核入账'
                    : compensation.status === 'credited'
                      ? '已入账'
                      : '已驳回'}
                </span>
              </span>
            </div>
          )}
          {compensation?.reviewedByUser?.phone && compensation?.reviewedAt && (
            <>
              <div className="field-inline-row">
                <span className="field-label">退款审核人</span>
                <span className="field-inline-value" style={{ color: 'var(--color-muted)', fontSize: 13 }}>
                  {compensation.reviewedByUser.phone}
                </span>
              </div>
              <div className="field-inline-row">
                <span className="field-label">退款审核时间</span>
                <span className="field-inline-value" style={{ color: 'var(--color-muted)', fontSize: 13 }}>
                  {formatDateTime(compensation.reviewedAt)}
                </span>
              </div>
            </>
          )}
          {normalSettlement && !compensation && (
            <div className="field-inline-row">
              <span className="field-label">本单收入</span>
              <span className="field-inline-value">
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>¥{normalSettlement.masterAmount}</span>
                {Number(normalSettlement.platformFee) > 0
                  ? `（平台服务费 ¥${normalSettlement.platformFee}）`
                  : ''}
              </span>
            </div>
          )}
          {order.status === 'refunded' && !compensation && !normalSettlement && (
            <div className="field-inline-row">
              <span className="field-label">退款说明</span>
              <span className="field-inline-value" style={{ color: 'var(--color-muted)' }}>
                全额退款 · 本单未产生收入
              </span>
            </div>
          )}
          {order.status === 'departing' && (
            <div className="field-inline-row">
              <span className="field-label">流转状态</span>
              <span className="field-inline-value" style={{ color: 'var(--color-danger)' }}>师傅已出发，正在前往客户地址</span>
            </div>
          )}
          {order.status === 'arrived' && (
            <div className="field-inline-row">
              <span className="field-label">流转状态</span>
              <span className="field-inline-value" style={{ color: 'var(--color-danger)' }}>已到达现场，等待开始服务</span>
            </div>
          )}
          {order.status === 'pending_confirm' && (
            <div className="field-inline-row">
              <span className="field-label">流转状态</span>
              <span className="field-inline-value" style={{ color: 'var(--color-danger)' }}>服务已完成，等待客户验收</span>
            </div>
          )}
        </div>

        {order.review && (
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>客户评价</div>
            <div className="field-inline-row">
              <span className="field-label">评分</span>
              <span className="field-inline-value" style={{ color: '#f5a623', letterSpacing: 2 }}>
                {'★'.repeat(order.review.rating)}
                <span style={{ color: 'var(--color-muted)' }}>{'★'.repeat(5 - order.review.rating)}</span>
              </span>
            </div>
            {order.review.comment && (
              <div className="field-inline-row">
                <span className="field-label">评价内容</span>
                <span className="field-inline-value">{order.review.comment}</span>
              </div>
            )}
            {order.review.anonymous && (
              <div className="field-inline-row">
                <span className="field-label">评价方式</span>
                <span className="field-inline-value">客户选择了匿名评价</span>
              </div>
            )}
            {order.review.createdAt && (
              <div className="field-inline-row">
                <span className="field-label">评价时间</span>
                <span className="field-inline-value">
                  {formatDateTime(order.review.createdAt)}
                </span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {isPoolOrder && (
            <button type="button" className="btn-primary" onClick={() => setGrabOpen(true)}>
              抢单
            </button>
          )}
          {order.status === 'accepted' && (
            <button type="button" className="btn-primary" onClick={() => setDepartOpen(true)}>
              出发上门
            </button>
          )}
          {order.status === 'departing' && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setArriveDigits(Array(6).fill(''));
                setArriveOpen(true);
              }}
            >
              确认到达
            </button>
          )}
          {order.status === 'arrived' && (
            <button type="button" className="btn-primary" onClick={() => setStartOpen(true)}>
              开始服务
            </button>
          )}
          {order.status === 'servicing' && (
            <button type="button" className="btn-primary" onClick={() => setCompleteOpen(true)}>
              完成服务
            </button>
          )}
        </div>
      </div>
    <ConfirmDialog
      open={grabOpen}
      title="确认接单"
      message={`确认抢接订单「${order.orderNo}」吗？接单后请尽快联系客户、按预约时间上门服务。`}
      confirmLabel="确认接单"
      onConfirm={() => {
        setGrabOpen(false);
        onGrab();
      }}
      onCancel={() => setGrabOpen(false)}
    />
    <ConfirmDialog
      open={departOpen}
      title="确认出发上门"
      message={`确认订单「${order.orderNo}」已出发前往客户地址吗？确认后订单状态将变为「出发上门中」，客户可生成到达验证码。`}
      confirmLabel="确认出发"
      onConfirm={() => {
        setDepartOpen(false);
        onDepart();
      }}
      onCancel={() => setDepartOpen(false)}
    />
    {arriveOpen && (
      <div className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-panel modal-md">
          <div className="modal-header">
            <span>确认到达 — 输入验证码</span>
            <button type="button" className="modal-close" onClick={() => { if (!arriving) setArriveOpen(false); }} aria-label="关闭">×</button>
          </div>
          <div className="modal-body">
            <p style={{ marginTop: 0 }}>请输入客户当面出示的 6 位到达验证码：</p>
            <div className="code-inputs" style={{ margin: '18px 0 14px' }}>
              {arriveDigits.map((d, i) => (
                <input
                  key={i}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={d}
                  onChange={(e) => onDigitChange(i, e.target.value)}
                  onKeyDown={(e) => onDigitKeyDown(i, e)}
                  ref={(el) => { codeRefs.current[i] = el; }}
                  autoFocus={i === 0}
                  aria-label={`验证码第 ${i + 1} 位`}
                  disabled={arriving}
                />
              ))}
            </div>
            <p className="field-hint" style={{ margin: '6px 0 0', textAlign: 'center' }}>
              验证码由客户在订单详情页生成，请让客户当面出示（不要通过聊天发送）。
            </p>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setArriveOpen(false)} disabled={arriving}>
              取消
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={onArrive}
              disabled={arriving || arriveCodeStr.length !== 6}
            >
              {arriving ? '验证中…' : '确认到达'}
            </button>
          </div>
        </div>
      </div>
    )}
    <ConfirmDialog
      open={startOpen}
      title="确认开始服务"
      message={`确认订单「${order.orderNo}」已到达现场并开始服务吗？确认后订单将进入「服务中」状态。`}
      confirmLabel="确认开始"
      onConfirm={() => {
        setStartOpen(false);
        onStart();
      }}
      onCancel={() => setStartOpen(false)}
    />
    <ConfirmDialog
      open={completeOpen}
      title="确认完成服务"
      message={`确认订单「${order.orderNo}」服务已完成吗？确认后订单将进入「待客户验收」状态，等待客户确认验收。`}
      confirmLabel="确认完成"
      onConfirm={() => {
        setCompleteOpen(false);
        onComplete();
      }}
      onCancel={() => setCompleteOpen(false)}
    />
    </>
  );
}
