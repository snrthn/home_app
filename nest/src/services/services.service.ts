import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// pnpm 的 @prisma/client 是只读软链，生成客户端实际位于 node_modules/.prisma/client
import {
  ServiceType,
  ServiceItem,
  ServiceCategory,
} from '../../node_modules/.prisma/client';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  // ===================== 服务类目 =====================
  async listCategories() {
    return this.prisma.serviceCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ sort: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { items: true } } },
    });
  }

  async getCategory(id: string): Promise<ServiceCategory> {
    const c = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('服务类目不存在');
    return c;
  }

  async createCategory(dto: {
    name: string;
    description?: string;
    icon?: string;
    sort?: number;
    isActive?: boolean;
  }): Promise<ServiceCategory> {
    return this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
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
    return this.prisma.serviceCategory.update({ where: { id }, data });
  }

  // 类目删除保护：仍有「未软删」项目时禁止删除，避免项目变孤儿。
  // 采用软删除（置 deletedAt + isActive=false）：项目即使已被软删仍持有该类目的外键，
  // 硬删会触发外键约束报错；软删既隐藏类目又不破坏历史订单引用的完整性。
  async removeCategory(id: string): Promise<ServiceCategory> {
    await this.getCategory(id);
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
    type: ServiceType;
    province?: string;
    provinceCode?: string;
    city?: string;
    cityCode?: string;
    district?: string;
    districtCode?: string;
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
        type: dto.type,
        province: dto.province ?? null,
        provinceCode: dto.provinceCode ?? null,
        city: dto.city ?? null,
        cityCode: dto.cityCode ?? null,
        district: dto.district ?? null,
        districtCode: dto.districtCode ?? null,
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
      type: ServiceType;
      province: string;
      provinceCode: string;
      city: string;
      cityCode: string;
      district: string;
      districtCode: string;
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
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.province !== undefined) data.province = dto.province ?? null;
    if (dto.provinceCode !== undefined) data.provinceCode = dto.provinceCode ?? null;
    if (dto.city !== undefined) data.city = dto.city ?? null;
    if (dto.cityCode !== undefined) data.cityCode = dto.cityCode ?? null;
    if (dto.district !== undefined) data.district = dto.district ?? null;
    if (dto.districtCode !== undefined) data.districtCode = dto.districtCode ?? null;
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
  async listPublicItems(opts?: { city?: string; type?: string }): Promise<(ServiceItem & { category: ServiceCategory })[]> {
    return this.prisma.serviceItem.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(opts?.city ? { city: opts.city } : {}),
        ...(opts?.type ? { type: opts.type as ServiceType } : {}),
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
      include: { category: true },
    });
  }

  async listPublicCategories() {
    return this.prisma.serviceCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sort: 'asc' }, { name: 'asc' }],
    });
  }
}
