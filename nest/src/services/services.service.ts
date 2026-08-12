import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// pnpm 的 @prisma/client 是只读软链，生成客户端实际位于 node_modules/.prisma/client
import {
  ServiceItem,
  ServiceCategory,
} from '../../node_modules/.prisma/client';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  // ===================== 服务类目 =====================
  async listCategories(): Promise<(ServiceCategory & { _count: { items: number } })[]> {
    // 项目删除为软删除（仅置 deletedAt + isActive=false，外键 categoryId 保留），
    // 因此 _count 必须按「未删除项目」过滤，否则软删项目仍会被计入类目关联数。
    const cats = await this.prisma.serviceCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ sort: 'asc' }, { name: 'asc' }],
      include: { items: { where: { deletedAt: null }, select: { id: true } } },
    });
    return cats.map((c) => {
      const { items, ...rest } = c;
      return { ...rest, _count: { items: items.length } };
    });
  }

  async getCategory(id: string): Promise<ServiceCategory> {
    const c = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('服务类目不存在');
    return c;
  }

  async createCategory(dto: {
    name: string;
    parentId?: string | null;
    level?: number;
    description?: string;
    icon?: string;
    sort?: number;
    isActive?: boolean;
  }): Promise<ServiceCategory> {
    let level = dto.level ?? 1;
    if (dto.parentId) {
      const parent = await this.prisma.serviceCategory.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException('上级类目不存在');
      level = parent.level + 1;
      if (level > 3) throw new BadRequestException('类目最多支持三级');
    }
    return this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
        level,
        description: dto.description ?? null,
        icon: dto.icon ?? null,
        sort: dto.sort ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCategory(
    id: string,
    dto: Partial<{
      name: string;
      parentId: string | null;
      description: string;
      icon: string;
      sort: number;
      isActive: boolean;
    }>,
  ): Promise<ServiceCategory> {
    await this.getCategory(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.icon !== undefined) data.icon = dto.icon ?? null;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        const parent = await this.prisma.serviceCategory.findUnique({ where: { id: dto.parentId } });
        if (!parent) throw new BadRequestException('上级类目不存在');
        const lvl = parent.level + 1;
        if (lvl > 3) throw new BadRequestException('类目最多支持三级');
        data.level = lvl;
        data.parentId = dto.parentId;
      } else {
        data.level = 1;
        data.parentId = null;
      }
    }
    return this.prisma.serviceCategory.update({ where: { id }, data });
  }

  // 类目删除保护：仍有「未软删」项目时禁止删除，避免项目变孤儿。
  // 采用软删除（置 deletedAt + isActive=false）：项目即使已被软删仍持有该类目的外键，
  // 硬删会触发外键约束报错；软删既隐藏类目又不破坏历史订单引用的完整性。
  async removeCategory(id: string): Promise<ServiceCategory> {
    await this.getCategory(id);
    // 先查子级类目：存在子节点时必须先删除子节点，否则会留下孤儿类目
    const childCount = await this.prisma.serviceCategory.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new BadRequestException(`该类目下仍有 ${childCount} 个子级类目，请先删除子节点后再删除`);
    }
    const count = await this.prisma.serviceItem.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (count > 0) {
      throw new BadRequestException('该类目下仍有服务项目，请先移除项目后再删除');
    }
    return this.prisma.serviceCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ===================== 服务项目 =====================
  async listItems(opts?: { categoryId?: string }): Promise<(ServiceItem & { category: ServiceCategory })[]> {
    return this.prisma.serviceItem.findMany({
      where: {
        deletedAt: null,
        ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}),
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
      include: { category: true },
    });
  }

  async getItem(id: string): Promise<ServiceItem & { category: ServiceCategory }> {
    const it = await this.prisma.serviceItem.findFirst({
      where: { id, deletedAt: null },
      include: { category: true },
    });
    if (!it) throw new NotFoundException('服务项目不存在');
    return it;
  }

  async createItem(dto: {
    categoryId: string;
    name: string;
    price: number;
    unit?: string;
    description?: string;
    coverImage?: string;
    estimatedDuration?: number;
    sort?: number;
    isActive?: boolean;
  }): Promise<ServiceItem & { category: ServiceCategory }> {
    const cat = await this.prisma.serviceCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!cat) throw new BadRequestException('所属类目不存在');
    return this.prisma.serviceItem.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        price: dto.price,
        unit: dto.unit ?? null,
        description: dto.description ?? null,
        coverImage: dto.coverImage ?? null,
        estimatedDuration: dto.estimatedDuration ?? null,
        sort: dto.sort ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: { category: true },
    });
  }

  async updateItem(
    id: string,
    dto: Partial<{
      categoryId: string;
      name: string;
      price: number;
      unit: string;
      description: string;
      coverImage: string;
      estimatedDuration: number;
      sort: number;
      isActive: boolean;
    }>,
  ): Promise<ServiceItem & { category: ServiceCategory }> {
    await this.getItem(id);
    const data: Record<string, unknown> = {};
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.unit !== undefined) data.unit = dto.unit ?? null;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.coverImage !== undefined) data.coverImage = dto.coverImage ?? null;
    if (dto.estimatedDuration !== undefined) data.estimatedDuration = dto.estimatedDuration ?? null;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.serviceItem.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  // 软删除：置 isActive=false + deletedAt。订单仍通过 serviceSnapshot 引用该项目，不受影响。
  async removeItem(id: string): Promise<ServiceItem & { category: ServiceCategory }> {
    await this.getItem(id);
    return this.prisma.serviceItem.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
      include: { category: true },
    });
  }

  // ===================== 公开（下单/选服务） =====================
  async listPublicItems(): Promise<(ServiceItem & { category: ServiceCategory })[]> {
    return this.prisma.serviceItem.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
      include: { category: true },
    });
  }

  async listPublicCategories(): Promise<ServiceCategory[]> {
    return this.prisma.serviceCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sort: 'asc' }, { name: 'asc' }],
    });
  }

  // 返回嵌套树（最多三级），供前端三级联动下拉定位服务。
  async getCategoryTree(): Promise<any[]> {
    const cats = await this.prisma.serviceCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ level: 'asc' }, { sort: 'asc' }, { name: 'asc' }],
    });
    const map = new Map<string, any>();
    cats.forEach((c) => map.set(c.id, { ...c, children: [] as any[] }));
    const roots: any[] = [];
    cats.forEach((c) => {
      const node = map.get(c.id)!;
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }
}
