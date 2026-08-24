import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../gateway/orders.gateway';
import { PaymentsService } from '../payments/payments.service';
import { SettlementsService } from '../settlements/settlements.service';
import type { CreateTicketDto, AppealDto, ResolveComplaintDto } from './tickets.dto';

// SLA 档位（分钟）：首响 / 处理完结
const SLA_FIRST_MIN = { urgent: 30, high: 120, normal: 1440, low: 4320 };
const SLA_RESOLVE_MIN = { urgent: 480, high: 1440, normal: 4320, low: 10080 };

// 仅已完成订单可投诉
const COMPLAINTABLE = ['reviewed', 'evaluated'];

export interface TicketListFilter {
  status?: string;
  type?: string;
  priority?: string;
  assignee?: string;
  my?: string;
  active?: string;
}

interface AddCommentInput {
  content: string;
  isInternal?: boolean;
  visibleTo?: string;
}

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private gateway: OrdersGateway,
    private payments: PaymentsService,
    private settlements: SettlementsService,
  ) {}

  private async nextTicketNo(): Promise<string> {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const count = await this.prisma.ticket.count({ where: { createdAt: { gte: todayStart } } });
    return `GT${ymd}${String(count + 1).padStart(4, '0')}`;
  }

  private slaDeadlines(priority: string) {
    const p = priority as keyof typeof SLA_FIRST_MIN;
    const f = SLA_FIRST_MIN[p] ?? 1440;
    const r = SLA_RESOLVE_MIN[p] ?? 4320;
    return {
      firstResponseDeadline: new Date(Date.now() + f * 60000),
      resolveDeadline: new Date(Date.now() + r * 60000),
    };
  }

  // 提交工单（客户/师傅/系统均可；投诉强校验已完成订单）
  async createTicket(actorId: string, dto: CreateTicketDto) {
    const type = dto.type ?? 'consult';
    if (type === 'complaint') {
      if (!dto.orderId) throw new BadRequestException('投诉必须关联订单');
      const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
      if (!order) throw new NotFoundException('订单不存在');
      if (!COMPLAINTABLE.includes(order.status))
        throw new BadRequestException('仅已完成订单（reviewed/evaluated）可投诉');
      if (order.customerId !== actorId)
        throw new ForbiddenException('只能投诉本人订单');
    }
    let priority = dto.priority ?? 'normal';
    if (type === 'complaint') priority = dto.reason === 'damage' ? 'urgent' : 'high';
    const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
    if (!VALID_PRIORITIES.includes(priority)) priority = 'normal';
    const sla = this.slaDeadlines(priority);

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNo: await this.nextTicketNo(),
        type: type as never,
        source: dto.source ?? 'client',
        title: dto.title,
        content: dto.content,
        images: dto.images ?? undefined,
        status: 'open',
        priority: priority as never,
        orderId: dto.orderId ?? null,
        reviewId: dto.reviewId ?? null,
        customerId: type === 'complaint' ? actorId : dto.customerId ?? null,
        masterId: dto.masterId ?? null,
        firstResponseDeadline: sla.firstResponseDeadline,
        resolveDeadline: sla.resolveDeadline,
        complaint:
          type === 'complaint'
            ? {
                create: {
                  againstMasterId: dto.againstMasterId ?? null,
                  reason: dto.reason as never,
                  expectation: dto.expectation ?? null,
                  handledAt: new Date(),
                },
              }
            : undefined,
      },
      include: { complaint: true },
    });
    this.gateway.broadcastTicketUpdate(ticket);
    return ticket;
  }

  // 工单池列表（管理端过滤）
  async list(filter: TicketListFilter) {
    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status as never;
    if (filter.type) where.type = filter.type as never;
    if (filter.priority) where.priority = filter.priority as never;
    if (filter.assignee) where.assigneeId = filter.assignee;
    if (filter.my) where.assigneeId = filter.my;
    if (filter.active) where.status = { in: ['open', 'processing', 'pendingUser'] } as never;
    return this.prisma.ticket.findMany({
      where,
      orderBy: [{ escalationLevel: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        complaint: true,
        customer: { select: { id: true, phone: true } },
        master: { select: { id: true, realName: true } },
        assignee: { select: { id: true, phone: true } },
        order: { select: { id: true, orderNo: true, status: true, amount: true } },
      },
    });
  }

  // 我的工单/反馈：客户端按 customerId、师傅端按 masterId（role 区分）
  async listMine(actorId: string, role?: string) {
    const where = role === 'master' ? { masterId: actorId } : { customerId: actorId };
    return this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        complaint: true,
        order: { select: { id: true, orderNo: true, status: true } },
      },
    });
  }

  async getById(id: string) {    const t = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        complaint: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { operator: { select: { id: true, phone: true } } },
        },
        customer: { select: { id: true, phone: true, profile: { select: { nickname: true } } } },
        master: { select: { id: true, realName: true } },
        assignee: { select: { id: true, phone: true } },
        order: { select: { id: true, orderNo: true, status: true, amount: true } },
        review: { select: { id: true, rating: true, comment: true } },
        refunds: {
          select: {
            id: true,
            refundNo: true,
            amount: true,
            status: true,
            refundedAmount: true,
            reviewNote: true,
            reviewedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!t) throw new NotFoundException('工单不存在');
    return t;
  }

  // 添加留言（isInternal=内部备注，仅客服可见）
  async addComment(actorId: string, id: string, dto: AddCommentInput) {
    await this.getById(id);
    const c = await this.prisma.ticketComment.create({
      data: {
        ticketId: id,
        operatorId: actorId,
        content: dto.content,
        isInternal: !!dto.isInternal,
        visibleTo: dto.visibleTo ?? 'all',
      },
    });
    // 首次对外响应 → 工单进入受理中
    if (!dto.isInternal) {
      const updated = await this.prisma.ticket.update({
        where: { id },
        data: { status: 'processing' },
      });
      this.gateway.broadcastTicketUpdate(updated);
    }
    return c;
  }

  // 师傅申诉（对外留言，客服可见）：复用 addComment，visibleTo=master
  async appeal(actorId: string, id: string, dto: AppealDto) {
    return this.addComment(actorId, id, {
      content: dto.content,
      isInternal: false,
      visibleTo: 'master',
    });
  }

  // 改派受理人
  async assign(id: string, assigneeId: string) {
    const t = await this.prisma.ticket.update({
      where: { id },
      data: { assigneeId, status: 'processing' },
    });
    this.gateway.broadcastTicketUpdate(t);
    return t;
  }

  // 状态流转
  async changeStatus(id: string, to: string) {
    const allowed = ['open', 'processing', 'pendingUser', 'resolved', 'rejected', 'closed'];
    if (!allowed.includes(to)) throw new BadRequestException('非法状态');
    const data: { status: string; closedAt?: Date } = { status: to };
    if (to === 'resolved' || to === 'closed') data.closedAt = new Date();
    const t = await this.prisma.ticket.update({ where: { id }, data: data as never });
    this.gateway.broadcastTicketUpdate(t);
    return t;
  }

  // 投诉处置（complaints:handle）：结果四选一，联动退款/补偿
  async resolveComplaint(actorId: string, id: string, dto: ResolveComplaintDto) {
    const t = await this.getById(id);
    if (t.type !== 'complaint') throw new BadRequestException('仅投诉工单可处置');
    if (!t.complaint) throw new BadRequestException('投诉数据缺失');
    if (!dto.result) throw new BadRequestException('处置结果必填');
    const ALLOWED_RESULTS = ['refund', 'compensate', 'redispatch', 'no_fault'];
    if (!ALLOWED_RESULTS.includes(dto.result))
      throw new BadRequestException('处置结果非法');
    const result = dto.result;
    let refundSettlementId: string | null = null;
    const order = t.order;
    if (result === 'refund' && order) {
      // 审核流：仅创建退款申请（pending_review），不直接退款。
      // 已完单（reviewed/evaluated）直接调 payments.refund 会被状态机双重拦截，
      // 且缺人工审核；运营在管理端「退款/售后」台账审核通过后才执行阶梯退款。
      // 详见 docs/refund-aftersale-design.md 第 3 节。
      const reason = t.complaint.expectation
        ? `${t.complaint.expectation}（投诉分类：${t.complaint.reason}）`
        : `投诉分类：${t.complaint.reason}`;
      await this.payments.createRefundRequest({
        ticketId: id,
        orderId: order.id,
        amount: Number(order.amount),
        reason,
        requestedBy: actorId,
      });
    } else if (result === 'compensate' && order) {
      // 平台承担全额补偿，师傅不动（compensation 结算单：师傅 0，平台留成=订单金额）
      const comp = await this.settlements.createCompensation(
        order.id,
        0,
        Number(order.amount),
        'complaint',
      );
      refundSettlementId = comp?.id ?? null;
    }
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'resolved', closedAt: new Date() },
    });
    await this.prisma.complaint.update({
      where: { ticketId: id },
      data: { result: result as never, handledById: actorId, handledAt: new Date(), refundSettlementId },
    });
    this.gateway.broadcastTicketUpdate(updated);
    return updated;
  }

  // SLA 自动升级（SlaService 定时调用）
  async escalateDue(now = new Date()) {
    const active = await this.prisma.ticket.findMany({
      where: { status: { in: ['open', 'processing', 'pendingUser'] } },
    });
    const due: Awaited<ReturnType<typeof this.prisma.ticket.update>>[] = [];
    for (const t of active) {
      const data: Record<string, unknown> = {};
      let changed = false;
      if (!t.escalatedFirstResponse && t.firstResponseDeadline && t.firstResponseDeadline < now && t.status === 'open') {
        data.priority = this.bumpPriority(t.priority);
        data.escalatedFirstResponse = true;
        if (['high', 'urgent'].includes(t.priority)) data.assigneeId = await this.findLead();
        changed = true;
      }
      if (!t.escalatedResolve && t.resolveDeadline && t.resolveDeadline < now) {
        data.priority = 'urgent';
        data.escalationLevel = (t.escalationLevel ?? 0) + 1;
        data.escalatedResolve = true;
        data.assigneeId = await this.findLead();
        changed = true;
      }
      if (changed) {
        const u = await this.prisma.ticket.update({ where: { id: t.id }, data: data as never });
        await this.prisma.ticketComment.create({
          data: {
            ticketId: t.id,
            operatorId: null,
            content: 'SLA 超时自动升级',
            isInternal: true,
            visibleTo: 'all',
          },
        });
        this.gateway.broadcastTicketUpdate(u);
        due.push(u);
      }
    }
    return due;
  }

  private bumpPriority(p: string) {
    return (
      { low: 'normal', normal: 'high', high: 'urgent', urgent: 'urgent' } as Record<string, string>
    )[p] ?? 'normal';
  }

  // 取具备工单/投诉权限的管理员（ops_lead / cs_agent）作升级改派对象
  private async findLead(): Promise<string | null> {
    const role = await this.prisma.staffRole.findFirst({
      where: { key: { in: ['ops_lead', 'cs_agent'] } },
      include: { users: { where: { deletedAt: null }, take: 1 } },
    });
    return role?.users?.[0]?.id ?? null;
  }
}
