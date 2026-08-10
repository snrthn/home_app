import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SCOPES = ['customer', 'master', 'admin'];
const TYPES = ['registration', 'privacy'];

@Injectable()
export class AgreementsService {
  constructor(private prisma: PrismaService) {}

  private assertScopeType(scope: string, type: string) {
    if (!SCOPES.includes(scope)) throw new BadRequestException('scope 非法');
    if (!TYPES.includes(type)) throw new BadRequestException('type 非法');
  }

  // 新建协议类型（某端 + 某类型，code 唯一）
  async createTemplate(
    createdBy: string,
    dto: { scope: string; type: string; title: string },
  ) {
    this.assertScopeType(dto.scope, dto.type);
    const code = `${dto.scope}-${dto.type}`;
    const exist = await this.prisma.agreementTemplate.findUnique({
      where: { code },
    });
    if (exist) throw new BadRequestException('该端该类型的协议已存在');
    return this.prisma.agreementTemplate.create({
      data: {
        scope: dto.scope as any,
        type: dto.type as any,
        code,
        title: dto.title,
      },
    });
  }

  // 修改协议类型名称（创建后允许修正；code 与已有版本不受影响）
  async updateTemplate(id: string, dto: { title?: string }) {
    const tpl = await this.prisma.agreementTemplate.findUnique({
      where: { id, deletedAt: null },
    });
    if (!tpl) throw new NotFoundException('协议类型不存在');
    return this.prisma.agreementTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
      },
    });
  }

  // 列表：模板 + 各版本（按版本倒序），用于管理端表格
  async listTemplates() {
    return this.prisma.agreementTemplate.findMany({
      where: { deletedAt: null },
      orderBy: [{ scope: 'asc' }, { type: 'asc' }],
      include: {
        versions: {
          where: { deletedAt: null },
          orderBy: { version: 'desc' },
        },
      },
    });
  }

  // 新建版本：版本号 = 模板内 max(version) + 1，初始草稿、非当前
  async createVersion(
    createdBy: string,
    templateId: string,
    dto: { title: string; contentHtml?: string },
  ) {
    const tpl = await this.prisma.agreementTemplate.findUnique({
      where: { id: templateId, deletedAt: null },
    });
    if (!tpl) throw new NotFoundException('协议不存在');
    const max = await this.prisma.agreementVersion.aggregate({
      where: { templateId, deletedAt: null },
      _max: { version: true },
    });
    const next = (max._max.version ?? 0) + 1;
    return this.prisma.agreementVersion.create({
      data: {
        templateId,
        version: next,
        title: dto.title,
        contentHtml: dto.contentHtml ?? null,
        status: 'draft',
        isCurrent: false,
        createdBy,
      },
    });
  }

  // 编辑版本：仅草稿可改（已上架/下架版本不可直接改，需新建版本）
  async updateVersion(
    templateId: string,
    vid: string,
    dto: { title?: string; contentHtml?: string },
  ) {
    const v = await this.prisma.agreementVersion.findFirst({
      where: { id: vid, templateId, deletedAt: null },
    });
    if (!v) throw new NotFoundException('版本不存在');
    if (v.status !== 'draft')
      throw new BadRequestException('仅草稿版本可编辑，请新建版本后再上架');
    return this.prisma.agreementVersion.update({
      where: { id: vid },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.contentHtml !== undefined ? { contentHtml: dto.contentHtml } : {}),
      },
    });
  }

  // 上架：本版本置为当前生效，并取消同模板其他版本的 current（事务）
  async publish(templateId: string, vid: string) {
    const v = await this.prisma.agreementVersion.findFirst({
      where: { id: vid, templateId, deletedAt: null },
    });
    if (!v) throw new NotFoundException('版本不存在');
    return this.prisma.$transaction(async (tx) => {
      await tx.agreementVersion.update({
        where: { id: vid },
        data: { status: 'published', isCurrent: true },
      });
      await tx.agreementVersion.updateMany({
        where: { templateId, id: { not: vid }, isCurrent: true },
        data: { isCurrent: false },
      });
      return tx.agreementVersion.findUnique({ where: { id: vid } });
    });
  }

  // 下架：本版本失效；若无其他生效版本，公开页将隐藏入口
  async offline(templateId: string, vid: string) {
    const v = await this.prisma.agreementVersion.findFirst({
      where: { id: vid, templateId, deletedAt: null },
    });
    if (!v) throw new NotFoundException('版本不存在');
    return this.prisma.agreementVersion.update({
      where: { id: vid },
      data: { status: 'offline', isCurrent: false },
    });
  }

  // 公开：取某端某类型当前生效版本；无则 null
  async getDefault(scope: string, type: string) {
    this.assertScopeType(scope, type);
    const tpl = await this.prisma.agreementTemplate.findFirst({
      where: { scope: scope as any, type: type as any, deletedAt: null },
    });
    if (!tpl) return null;
    const v = await this.prisma.agreementVersion.findFirst({
      where: {
        templateId: tpl.id,
        isCurrent: true,
        status: 'published',
        deletedAt: null,
      },
    });
    if (!v) return null;
    return {
      id: v.id,
      templateId: tpl.id,
      scope: tpl.scope,
      type: tpl.type,
      code: tpl.code,
      title: v.title,
      version: v.version,
      contentHtml: v.contentHtml,
      updatedAt: v.updatedAt,
    };
  }
}
