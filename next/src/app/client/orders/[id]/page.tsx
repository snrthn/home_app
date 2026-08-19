'use client';

import { useState } from 'react';
import { PortalNavSetter } from '@/components/PortalShell';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyOrders, payByMock, confirmOrder, cancelMyOrder, generateArriveCode, createReview, getSettlementsByOrder } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg, resolveAsset } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Modal } from '@/components/Modal';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderStatus } from '@/lib/order-status';
import { StatusBadge } from '@/components/admin/DataTable';
import EmptyState from '@/components/EmptyState';
import { useOrderSocket } from '@/lib/useOrderSocket';
import { formatDateTime } from '@/lib/format';
import { CopyButton } from '@/components/CopyText';

// 可取消的状态：支付前取消无退款；支付后取消走退款
const CANCELABLE: OrderStatus[] = [
  'pending_payment',
  'pending_accept',
  'accepted',
  'departing',
  'arrived',
  'servicing',
  'pending_confirm',
];

export default function ClientOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [arriveCode, setArriveCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewAnonymous, setReviewAnonymous] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: QK.orderMine,
    queryFn: getMyOrders,
    refetchOnMount: 'always',
  });
  const order = orders.find((o) => o.id === id);

  // 退款补偿说明（按订单查结算单，含退款补偿单）
  const { data: settlements = [] } = useQuery({
    queryKey: ['settlementsByOrder', id],
    queryFn: () => getSettlementsByOrder(id),
    refetchOnMount: 'always',
  });
  const compensation = settlements.find((s) => s.type === 'compensation') ?? null;

  const refresh = () => qc.invalidateQueries({ queryKey: QK.orderMine });
  const refreshMenu = [{ label: '刷新数据', onClick: refresh }];

  // 实时推送：师傅端流转（接单/出发/到达/开始/完成）或退款完成时，本单自动刷新
  useOrderSocket(
    {
      onOrderUpdate: (o: any) => {
        if (o?.id === id) refresh();
      },
    },
    { orderId: id },
  );

  const onPay = () => setPayOpen(true);
  const onPayConfirm = async () => {
    setPaying(true);
    try {
      // 模拟支付过程：保留短暂 loading，让用户感知「支付中…」而非一闪而过
      await new Promise((r) => setTimeout(r, 800));
      await payByMock(id);
      toast.success('支付成功，等待师傅接单');
      refresh();
      setPayOpen(false);
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setPaying(false);
    }
  };
  const onConfirm = async () => {
    try {
      await confirmOrder(id);
      toast.success('已确认验收，托管金已释放给师傅');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    }
  };
  const onGenerateArriveCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await generateArriveCode(id);
      setArriveCode(res.code);
      setCodeOpen(true);
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setGeneratingCode(false);
    }
  };
  const confirmCancel = async () => {
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error('请填写取消原因');
      return;
    }
    setCancelling(true);
    try {
      await cancelMyOrder(id, reason);
      toast.success('订单已取消');
      setCancelOpen(false);
      refresh();
      router.replace('/client/orders');
    } catch (e: any) {
      setCancelOpen(false);
      toast.error(getApiErrorMsg(e));
    } finally {
      setCancelling(false);
    }
  };

  // 阶梯退款文案：与后端 orders.cancel 的 refundRatioOf 保持一致
  const refundRatioText = (status: OrderStatus): string => {
    if (status === 'departing') return '因师傅已出发，已支付金额的 80% 将原路退回';
    if (status === 'arrived') return '因师傅已到达现场，已支付金额的 50% 将原路退回';
    return '已支付的托管金将全额原路退回';
  };

  const onSubmitReview = async () => {
    setReviewing(true);
    try {
      await createReview({
        orderId: id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
        anonymous: reviewAnonymous || undefined,
      });
      toast.success('评价成功，感谢您的反馈');
      setReviewOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setReviewing(false);
    }
  };

  if (isLoading) return <><PortalNavSetter
  title="订单详情"
  showBack
  backHref="/client/orders"
  menu={refreshMenu}
  onBack={() => {
    if (window.history.length > 1) router.back();
    else router.push('/client/orders');
  }}
/><div className="laoma-container order-mod"><p className="field-hint">加载中…</p></div></>;
  if (!order) return <><PortalNavSetter
  title="订单详情"
  showBack
  backHref="/client/orders"
  menu={refreshMenu}
  onBack={() => {
    if (window.history.length > 1) router.back();
    else router.push('/client/orders');
  }}
/><div className="laoma-container order-mod"><div className="card"><EmptyState text="未找到该订单。" /></div></div></>;

  const addr = order.address;
  const addrLine = addr
    ? [addr.province, addr.city, addr.district, addr.detail].filter(Boolean).join('')
    : '-';

  return (
    <>
      <PortalNavSetter
  title="订单详情"
  showBack
  backHref="/client/orders"
  menu={refreshMenu}
  onBack={() => {
    if (window.history.length > 1) router.back();
    else router.push('/client/orders');
  }}
/>
      <div className="laoma-container order-mod">
        {/* 服务详情（点击查看完整服务介绍） */}
        <div
          className="card"
          role="button"
          tabIndex={0}
          onClick={() => order.serviceItem?.id && router.push(`/client/services/${order.serviceItem.id}`)}
          style={{ cursor: 'pointer' }}
        >
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <div className="field-inline-row" style={{ margin: 0 }}>
                  <span className="field-label">服务单价</span>
                  <span className="field-inline-value" style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}>
                    ¥{order.serviceItem?.price ?? order.amount}
                    {order.serviceItem?.unit ? `/${order.serviceItem.unit}` : ''}
                  </span>
                </div>
                {order.serviceItem?.id && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/client/services/${order.serviceItem!.id}?from=order&oid=${order.id}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/client/services/${order.serviceItem!.id}?from=order&oid=${order.id}`);
                      }
                    }}
                    style={{ color: 'var(--color-primary)', fontSize: 13, cursor: 'pointer', flex: '0 0 auto', whiteSpace: 'nowrap', paddingLeft: 12 }}
                  >
                    查看服务详情 ›
                  </span>
                )}
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
            <span className="field-inline-value">{addrLine}</span>
          </div>
          <div className="field-inline-row">
            <span className="field-label">联系人</span>
            <span className="field-inline-value">{addr?.contactName ?? '-'}</span>
          </div>
          <div className="field-inline-row">
            <span className="field-label">联系电话</span>
            <span className="field-inline-value">{addr?.contactPhone ?? '-'}</span>
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
          {(compensation || order.status === 'refunded') && (
            <div className="field-inline-row">
              <span className="field-label">退款金额</span>
              <span className="field-inline-value" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                ¥{Number(compensation?.refundAmount ?? order.amount).toFixed(2)} · 已原路退回
              </span>
            </div>
          )}
          {order.status === 'departing' && (
            <div className="field-inline-row">
              <span className="field-label">流转状态</span>
              <span className="field-inline-value" style={{ color: 'var(--color-danger)' }}>师傅已出发，正在前往您的地址</span>
            </div>
          )}
          {order.status === 'arrived' && (
            <div className="field-inline-row">
              <span className="field-label">流转状态</span>
              <span className="field-inline-value" style={{ color: 'var(--color-danger)' }}>师傅已到达现场，正在准备服务</span>
            </div>
          )}
          {(order.status === 'refunding' || order.status === 'refunded' || order.status === 'cancelled') && (
            <div className="field-inline-row">
              <span className="field-label">流转状态</span>
              <span className="field-inline-value" style={{ color: 'var(--color-danger)' }}>
                {ORDER_STATUS_LABEL[order.status]}
                {order.status === 'cancelled'
                  ? '（订单未完成支付）'
                  : '（资金状态以平台为准）'}
              </span>
            </div>
          )}
        </div>

        {order.master && (
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>师傅信息</div>
            <div className="field-inline-row">
              <span className="field-label">接单师傅</span>
              <span className="field-inline-value">
                {order.master.realName ?? order.master.user?.profile?.nickname ?? '-'}
              </span>
            </div>
            {order.master.user?.phone && (
              <div className="field-inline-row">
                <span className="field-label">师傅电话</span>
                <span className="field-inline-value">
                  <a href={`tel:${order.master.user.phone}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                    {order.master.user.phone}
                  </a>
                </span>
              </div>
            )}
            {(order.master.rating != null || order.master.orderCount != null) && (
              <div className="field-inline-row">
                <span className="field-label">师傅评分</span>
                <span className="field-inline-value">
                  {order.master.rating != null ? `★ ${order.master.rating} ` : ''}
                  {order.master.orderCount != null ? `已完成 ${order.master.orderCount} 单` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {order.review && (
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>我的评价</div>
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
                <span className="field-inline-value">匿名评价</span>
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
          {order.status === 'pending_payment' && (
            <button type="button" className="btn-primary" onClick={onPay}>
              去支付（模拟）
            </button>
          )}
          {order.status === 'departing' && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => (arriveCode ? setCodeOpen(true) : onGenerateArriveCode())}
              disabled={generatingCode}
            >
              {generatingCode ? '生成中…' : arriveCode ? '查看到达验证码' : '生成到达验证码'}
            </button>
          )}
          {order.status === 'pending_confirm' && (
            <button type="button" className="btn-primary" onClick={() => setConfirmOpen(true)}>
              确认验收
            </button>
          )}
          {(order.status === 'reviewed' || order.status === 'evaluated') && !order.review && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setReviewRating(5);
                setReviewComment('');
                setReviewAnonymous(false);
                setReviewOpen(true);
              }}
            >
              去评价
            </button>
          )}
          {order.status === 'evaluated' && order.serviceItem?.id && (
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                router.push(`/client/orders/new?serviceId=${order.serviceItem!.id}`)
              }
            >
              再来一单
            </button>
          )}
          {CANCELABLE.includes(order.status) && (
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                setCancelReason('');
                setCancelOpen(true);
              }}
            >
              {order.status === 'pending_payment' ? '取消订单' : '申请取消（退款）'}
            </button>
          )}
        </div>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => {
          if (!cancelling) setCancelOpen(false);
        }}
        title="取消订单"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              再想想
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={confirmCancel}
              disabled={cancelling || !cancelReason.trim()}
            >
              {cancelling ? '取消中…' : '确认取消'}
            </button>
          </>
        }
      >
        <p style={{ marginTop: 0 }}>
          {order.status === 'pending_payment'
            ? `订单「${order.orderNo}」尚未支付，取消后不产生退款。`
            : `订单「${order.orderNo}」当前为「${ORDER_STATUS_LABEL[order.status]}」，${refundRatioText(order.status)}，资金状态以平台为准。`}
        </p>
        <label className="field-label" htmlFor="cancel-reason">
          取消原因 <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <textarea
          id="cancel-reason"
          className="input"
          value={cancelReason}
          maxLength={200}
          placeholder="请填写取消原因，如：临时不需要了 / 时间冲突 / 与师傅沟通后取消…"
          onChange={(e) => setCancelReason(e.target.value)}
          disabled={cancelling}
          style={{ width: '100%', minHeight: 80, resize: 'vertical' }}
        />
        <p className="field-hint" style={{ margin: '6px 0 0' }}>
          取消原因将记录在订单日志中，便于后续追溯（必填，200 字以内）
        </p>
      </Modal>

      <ConfirmDialog
        open={payOpen}
        title="确认支付"
        message={`订单「${order.orderNo}」需支付 ¥${order.amount}。模拟支付通道将即时完成扣款并把资金托管至平台，等待师傅接单。确定支付吗？`}
        confirmLabel={paying ? '支付中…' : '确认支付 ¥' + order.amount}
        loading={paying}
        onConfirm={onPayConfirm}
        onCancel={() => {
          if (!paying) setPayOpen(false);
        }}
      />
      <Modal
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        title="到达验证码"
        footer={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setCodeOpen(false);
              refresh();
            }}
          >
            确定
          </button>
        }
      >
        <p style={{ marginTop: 0 }}>师傅到达现场后，请当面出示以下验证码供师傅核验：</p>
        <div className="arrive-code-display">{arriveCode}</div>
        <p className="field-hint" style={{ textAlign: 'center' }}>
          请勿通过聊天或电话提前告知，防止未到场先核验
        </p>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="确认验收"
        message={`确认订单「${order.orderNo}」服务已完成并验收通过吗？确认后托管金将释放给师傅，订单完成。`}
        confirmLabel="确认验收"
        onConfirm={() => {
          setConfirmOpen(false);
          onConfirm();
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <Modal
        open={reviewOpen}
        onClose={() => {
          if (!reviewing) setReviewOpen(false);
        }}
        title="评价本次服务"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setReviewOpen(false)} disabled={reviewing}>
              取消
            </button>
            <button type="button" className="btn-primary" onClick={onSubmitReview} disabled={reviewing || reviewRating < 1}>
              {reviewing ? '提交中…' : '提交评价'}
            </button>
          </>
        }
      >
        <p style={{ marginTop: 0 }}>
          订单「{order.orderNo}」已完成，{order.master ? `师傅「${order.master.realName ?? order.master.user?.profile?.nickname ?? '-'}」` : ''}
          服务还满意吗？打个分吧～
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '16px 0' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} 星`}
              onClick={() => setReviewRating(n)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: 30,
                lineHeight: 1,
                color: n <= reviewRating ? '#f5a623' : 'var(--color-muted)',
              }}
              disabled={reviewing}
            >
              ★
            </button>
          ))}
        </div>
        <label className="field-label" htmlFor="review-comment">服务评价（选填）</label>
        <textarea
          id="review-comment"
          className="input"
          rows={3}
          maxLength={200}
          placeholder="说说师傅的服务态度、专业程度吧～"
          value={reviewComment}
          onChange={(e) => setReviewComment(e.target.value)}
          disabled={reviewing}
          style={{ resize: 'vertical' }}
        />
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 13 }}
        >
          <input
            type="checkbox"
            checked={reviewAnonymous}
            onChange={(e) => setReviewAnonymous(e.target.checked)}
            disabled={reviewing}
          />
          匿名评价
        </label>
      </Modal>
    </>
  );
}
