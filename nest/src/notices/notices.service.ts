import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SCOPES = ['customer', 'master', 'admin'];
const STATUSES = ['draft', 'published', 'offline'];

export interface NoticeInput {
  scope: string;
  title: string;
  summary?: string;
  contentHtml?: string;
  pinned?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}

@Injectable()
export class NoticesService {
  constructor(private prisma: PrismaService) {}

  private assertScope(scope: string) {
    if (!SCOPES.includes(scope)) throw new BadRequestException('scope 非法');
  }

  // 管理端：全量列表（含草稿/已下线），按端分组、置顶优先、发布时间倒序
  async list(opts?: { scope?: string }) {
    return this.prisma.notice.findMany({
      where: opts?.scope ? { scope: opts.scope } : undefined,
      orderBy: [
        { scope: 'asc' },
        { pinned: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getById(id: string) {
    const n = await this.prisma.notice.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('公告不存在');
    return n;
  }

  async create(createdBy: string, dto: NoticeInput) {
    this.assertScope(dto.scope);
    if (!dto.title?.trim()) throw new BadRequestException('标题必填');
    return this.prisma.notice.create({
      data: {
        scope: dto.scope,
        title: dto.title.trim(),
        summary: dto.summary?.trim() || null,
        contentHtml: dto.contentHtml ?? '',
        pinned: !!dto.pinned,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        createdBy,
        status: 'draft',
      },
    });
  }

  async update(
    id: string,
    dto: Partial<NoticeInput> & { startAt?: string | null; endAt?: string | null },
  ) {
    await this.getById(id);
    const data: any = {};
    if (dto.scope !== undefined) {
      this.assertScope(dto.scope);
      data.scope = dto.scope;
    }
    if (dto.title !== undefined) {
      if (!dto.title.trim()) throw new BadRequestException('标题必填');
      data.title = dto.title.trim();
    }
    if (dto.summary !== undefined) data.summary = dto.summary?.trim() || null;
    if (dto.contentHtml !== undefined) data.contentHtml = dto.contentHtml;
    if (dto.pinned !== undefined) data.pinned = !!dto.pinned;
    if (dto.startAt !== undefined) {
      data.startAt = dto.startAt ? new Date(dto.startAt) : null;
    }
    if (dto.endAt !== undefined) {
      data.endAt = dto.endAt ? new Date(dto.endAt) : null;
    }
    return this.prisma.notice.update({ where: { id }, data });
  }

  async publish(id: string) {
    await this.getById(id);
    return this.prisma.notice.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
    });
  }

  async offline(id: string) {
    await this.getById(id);
    return this.prisma.notice.update({
      where: { id },
      data: { status: 'offline' },
    });
  }

  async remove(id: string) {
    await this.getById(id);
    return this.prisma.notice.delete({ where: { id } });
  }

  // 公开：取某端已发布且在生效时间窗内的公告，置顶优先、发布时间倒序。
  // 直接带 contentHtml，前端点击即用，避免二次请求。
  async getPublicList(scope: string) {
    this.assertScope(scope);
    const now = new Date();
    return this.prisma.notice.findMany({
      where: {
        scope,
        status: 'published',
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    });
  }
}
