import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OperationLogQuery {
  module?: string;
  action?: string;
  userId?: string;
  from?: string; // ISO datetime
  to?: string; // ISO datetime
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async findMany(q: OperationLogQuery) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));

    const where: Record<string, any> = {};
    if (q.module) where.module = q.module;
    if (q.action) where.action = q.action;
    if (q.userId) where.userId = q.userId;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(q.from);
      if (q.to) where.createdAt.lte = new Date(q.to);
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.operationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.operationLog.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }
}
