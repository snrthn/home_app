import api from './api';

// 退款/售后（管理端）接口封装。
// 权限：orders:refund（列表 + 通过/驳回由后端 @RequirePerm 校验）。
// 说明：仅投诉处置 result=refund 会创建退款申请单（pending_review），经本台账审核后执行退款；
// 取消订单自动退 / 客户端手动退为直接退款，不进入本台账。详见 docs/refund-aftersale-design.md。

export type RefundStatus = 'pending_review' | 'approved' | 'rejected';

export interface RefundItem {
  id: string;
  refundNo: string;
  orderId: string;
  ticketId: string | null;
  amount: string | number; // 申请退款金额（Decimal 序列化为字符串）
  reason: string | null;
  status: RefundStatus;
  requestedById: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  refundedAmount: string | number | null; // 实际执行退款金额（通过后回填）
  settlementId: string | null; // 关联的补偿结算单（通过后回填）
  createdAt: string;
  order?: {
    id: string;
    orderNo: string;
    amount: string | number;
    status: string;
    customer?: {
      phone?: string;
      profile?: { nickname?: string | null } | null;
    } | null;
  } | null;
  ticket?: { id: string; ticketNo: string; title: string } | null;
  requestedBy?: { id: string; phone?: string } | null;
  reviewedBy?: { id: string; phone?: string } | null;
  settlement?: { id: string; masterAmount?: string | number; status?: string } | null;
}

export interface RefundQuery {
  status?: RefundStatus | '';
  orderNo?: string;
}

// 退款台账（管理端）：支持状态 / 订单号筛选，关联订单、工单、发起人、审核人、结算单
export function getRefunds(q: RefundQuery = {}): Promise<RefundItem[]> {
  return api.get('/payments/refunds', { params: q }).then((r) => r.data ?? []);
}

// 审核通过：执行阶梯退款（已完单投诉放行），回填实退金额与补偿结算单
export function approveRefund(id: string, note?: string): Promise<RefundItem> {
  return api.post(`/payments/refunds/${id}/approve`, { note }).then((r) => r.data);
}

// 审核驳回：置驳回 + 工单内部备注
export function rejectRefund(id: string, note?: string): Promise<RefundItem> {
  return api.post(`/payments/refunds/${id}/reject`, { note }).then((r) => r.data);
}

// 运营主动发起退款（非投诉来源，进审核流）：按订单号解析
export function createRefund(orderNo: string, amount?: number, reason?: string): Promise<RefundItem> {
  return api.post('/payments/refunds', { orderNo, amount, reason }).then((r) => r.data);
}

// 中文枚举映射
export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  pending_review: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};

export const REFUND_STATUS_TONE: Record<RefundStatus, 'orange' | 'green' | 'red'> = {
  pending_review: 'orange',
  approved: 'green',
  rejected: 'red',
};
