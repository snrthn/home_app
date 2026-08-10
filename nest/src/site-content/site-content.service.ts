import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SiteContentInput {
  title?: string;
  contentHtml?: string;
}

@Injectable()
export class SiteContentService {
  constructor(private prisma: PrismaService) {}

  // 公开/管理端：按 key 取一条；不存在抛 404（前端据此回退静态兜底）
  async getByKey(key: string) {
    const row = await this.prisma.siteContent.findUnique({ where: { key } });
    if (!row) throw new NotFoundException('内容不存在');
    return row;
  }

  // 按 key 写入：存在则更新，不存在则新建（覆盖式，无版本）
  async upsert(key: string, dto: SiteContentInput) {
    const existing = await this.prisma.siteContent.findUnique({ where: { key } });
    const data: { title?: string; contentHtml?: string } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.contentHtml !== undefined) data.contentHtml = dto.contentHtml;

    if (existing) {
      return this.prisma.siteContent.update({ where: { key }, data });
    }
    return this.prisma.siteContent.create({
      data: {
        key,
        title: dto.title ?? '',
        contentHtml: dto.contentHtml ?? '',
      },
    });
  }
}
