import api from './api';
import type { RefundStatus } from './refunds-api';

// 工单 / 投诉管理（管理端）接口封装。
// 权限：列表/改派/流转需 tickets:manage；投诉处置需 complaints:handle（由后端 @RequirePerm 校验）。

export type TicketType = 'consult' | 'complaint' | 'refund' | 'report' | 'system';
export type TicketStatus = 'open' | 'processing' | 'pendingUser' | 'resolved' | 'rejected' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ComplaintResult = 'refund' | 'compensate' | 'redispatch' | 'no_fault';
export type ComplaintReason =
  | 'attitude'
  | 'quality'
  | 'fee'
  | 'late'
  | 'damage'
  | 'other';

export interface TicketComment {
  id: string;
  operatorId: string | null;
  operator?: { id: string; phone?: string } | null;
  content: string;
  isInternal: boolean;
  visibleTo: string;
  createdAt: string;
}

export interface TicketListItem {
  id: string;
  ticketNo: string;
  type: TicketType;
  source: string;
  title: string;
  content: string;
  status: TicketStatus;
  priority: TicketPriority;
  orderId?: string | null;
  order?: { orderNo?: string; status?: string; amount?: string | number } | null;
  customerId?: string | null;
  customer?: { phone?: string } | null;
  masterId?: string | null;
  master?: { realName?: string } | null;
  assigneeId?: string | null;
  assignee?: { phone?: string } | null;
  firstResponseDeadline?: string | null;
  resolveDeadline?: string | null;
  escalatedFirstResponse: boolean;
  escalatedResolve: boolean;
  escalationLevel: number;
  createdAt: string;
  complaint?: { reason?: ComplaintReason; result?: ComplaintResult | null } | null;
}

export interface TicketDetail extends TicketListItem {
  images?: unknown;
  closedAt?: string | null;
  comments: TicketComment[];
  review?: { id: string; rating?: number; comment?: string } | null;
  // 投诉处置 result=refund 生成的退款申请单（管理端「退款/售后」台账审核）
  refunds?: {
    id: string;
    refundNo: string;
    amount: string | number;
    status: RefundStatus;
    refundedAmount: string | number | null;
    reviewNote: string | null;
    reviewedAt: string | null;
    createdAt: string;
  }[];
}

export interface TicketListQuery {
  status?: TicketStatus;
  type?: TicketType;
  priority?: TicketPriority;
  assignee?: string;
  my?: string;
  active?: boolean;
}

// 工单池列表（管理端）
export function getTickets(q: TicketListQuery = {}): Promise<TicketListItem[]> {
  return api.get('/tickets', { params: q }).then((r) => r.data ?? []);
}

// 工单详情（含留言时间线）
export function getTicket(id: string): Promise<TicketDetail> {
  return api.get(`/tickets/${id}`).then((r) => r.data);
}

// 添加留言（isInternal=true 为内部备注，仅客服可见）
export function addTicketComment(
  id: string,
  dto: { content: string; isInternal?: boolean; visibleTo?: string },
): Promise<TicketComment> {
  return api.post(`/tickets/${id}/comments`, dto).then((r) => r.data);
}

// 改派受理人（管理端）
export function assignTicket(id: string, assigneeId: string): Promise<TicketDetail> {
  return api.post(`/tickets/${id}/assign`, { assigneeId }).then((r) => r.data);
}

// 状态流转（管理端）
export function setTicketStatus(id: string, status: TicketStatus): Promise<TicketDetail> {
  return api.post(`/tickets/${id}/status`, { status }).then((r) => r.data);
}

// 投诉处置：结果四选一，联动退款/补偿（管理端 complaints:handle）
export function resolveComplaint(
  id: string,
  dto: { result: ComplaintResult },
): Promise<TicketDetail> {
  return api.post(`/tickets/${id}/complaint/resolve`, dto).then((r) => r.data);
}

// ============ 客户端：我的投诉 / 提交投诉 ============

export interface CreateComplaintDto {
  orderId: string;
  reason: ComplaintReason;
  title: string;
  content: string;
  expectation?: string;
  againstMasterId?: string | null;
}

// 客户提交投诉（后端强校验：订单须为 reviewed/evaluated 且是本人订单）
export function createComplaint(dto: CreateComplaintDto): Promise<TicketDetail> {
  return api.post('/tickets', { ...dto, type: 'complaint' }).then((r) => r.data);
}

// 我的工单 / 反馈（客户视角的历史记录）
export function getMyTickets(): Promise<TicketListItem[]> {
  return api.get('/tickets/mine').then((r) => r.data ?? []);
}

// 中文枚举映射
export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  consult: '咨询',
  complaint: '投诉',
  refund: '退款',
  report: '举报',
  system: '系统',
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: '待受理',
  processing: '受理中',
  pendingUser: '待用户',
  resolved: '已处理',
  rejected: '已驳回',
  closed: '已关闭',
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

export const PRIORITY_TONE: Record<TicketPriority, 'gray' | 'blue' | 'orange' | 'red'> = {
  low: 'gray',
  normal: 'blue',
  high: 'orange',
  urgent: 'red',
};

export const STATUS_TONE: Record<TicketStatus, 'gray' | 'blue' | 'orange' | 'green' | 'red'> = {
  open: 'gray',
  processing: 'blue',
  pendingUser: 'orange',
  resolved: 'green',
  rejected: 'red',
  closed: 'gray',
};

export const COMPLAINT_RESULT_LABEL: Record<ComplaintResult, string> = {
  refund: '退款',
  compensate: '补偿',
  redispatch: '重新服务',
  no_fault: '无责关闭',
};
