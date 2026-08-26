import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// pnpm 的 @prisma/client 是只读软链，生成客户端实际位于 node_modules/.prisma/client
import { ServiceArea } from '../../node_modules/.prisma/client';

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  // 所有已开通（未软删）的节点，按 省→市→区、sort、名称 排序，供前端组装树 / 列表
  async listAreas(): Promise<ServiceArea[]> {
    return this.prisma.serviceArea.findMany({
      where: { deletedAt: null },
      orderBy: [{ level: 'asc' }, { sort: 'asc' }, { name: 'asc' }],
    });
  }

  async getArea(id: string): Promise<ServiceArea> {
    const a = await this.prisma.serviceArea.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('服务区域节点不存在');
    return a;
  }

  // 由 6 段式推导层级、唯一编码、名称、父编码
  private derive(dto: {
    province: string;
    provinceCode: string;
    city?: string;
    cityCode?: string;
    district?: string;
    districtCode?: string;
  }) {
    const code = dto.districtCode || dto.cityCode || dto.provinceCode;
    const level = dto.districtCode ? 3 : dto.cityCode ? 2 : 1;
    const name = dto.district || dto.city || dto.province;
    const parentCode = dto.districtCode
      ? (dto.cityCode ?? null)
      : dto.cityCode
        ? dto.provinceCode
        : null;
    return { code, level, name, parentCode };
  }

  // 批量开通区域节点（单次事务，避免逐条请求触发限流）
  async batchCreate(dtos: {
    province: string;
    provinceCode: string;
    city?: string;
    cityCode?: string;
    district?: string;
    districtCode?: string;
    isActive?: boolean;
    sort?: number;
  }[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const dto of dtos) {
        const { code, level, name, parentCode } = this.derive(dto);
        const data = {
          code, level, name, parentCode,
          province: dto.province, provinceCode: dto.provinceCode,
          city: dto.city ?? null, cityCode: dto.cityCode ?? null,
          district: dto.district ?? null, districtCode: dto.districtCode ?? null,
          isActive: dto.isActive ?? true, deletedAt: null, sort: dto.sort ?? 0,
        };
        const existing = await tx.serviceArea.findFirst({ where: { code } });
        if (existing) {
          await tx.serviceArea.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await tx.serviceArea.create({ data });
          created++;
        }
      }
    });
    return { created, updated };
  }

  // 批量软删除区域节点（单次事务）
  async batchRemove(ids: string[]): Promise<{ deleted: number }> {
    const result = await this.prisma.serviceArea.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false, deletedAt: new Date() },
    });
    return { deleted: result.count };
  }

  // 开通一个区域节点。同 code 已存在（含曾被软删）则重新激活并更新字段，实现「关闭后再开通」。
  async createArea(dto: {
    province: string;
    provinceCode: string;
    city?: string;
    cityCode?: string;
    district?: string;
    districtCode?: string;
    isActive?: boolean;
    sort?: number;
  }): Promise<ServiceArea> {
    const { code, level, name, parentCode } = this.derive(dto);
    const data = {
      code,
      level,
      name,
      parentCode,
      province: dto.province,
      provinceCode: dto.provinceCode,
      city: dto.city ?? null,
      cityCode: dto.cityCode ?? null,
      district: dto.district ?? null,
      districtCode: dto.districtCode ?? null,
      isActive: dto.isActive ?? true,
      deletedAt: null,
      sort: dto.sort ?? 0,
    };
    const existing = await this.prisma.serviceArea.findFirst({ where: { code } });
    if (existing) {
      return this.prisma.serviceArea.update({ where: { id: existing.id }, data });
    }
    return this.prisma.serviceArea.create({ data });
  }

  async updateArea(
    id: string,
    dto: Partial<{ isActive: boolean; sort: number }>,
  ): Promise<ServiceArea> {
    await this.getArea(id);
    const data: Record<string, unknown> = {};
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sort !== undefined) data.sort = dto.sort;
    return this.prisma.serviceArea.update({ where: { id }, data });
  }

  // 软删除：置 isActive=false + deletedAt，保留历史引用完整性
  async removeArea(id: string): Promise<ServiceArea> {
    await this.getArea(id);
    return this.prisma.serviceArea.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
  }

  // 级联启停：
  // - 停用：自身 + 全体子孙 isActive=false（整支向下传递）
  // - 启用：仅自身 isActive=true；cascadeChildren 为真时连带全体子孙一并启用
  // 仅作用于已开通（deletedAt=null）的节点，未开通的子节点不在此集合内。
  async setAreaEnabled(
    id: string,
    enabled: boolean,
    cascadeChildren = false,
  ): Promise<void> {
    const target = await this.prisma.serviceArea.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('服务区域节点不存在');

    // 载入全部已开通节点，按 parentCode 建子表，BFS 收集子孙 id
    const all = await this.prisma.serviceArea.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, parentCode: true },
    });
    const childMap = new Map<string, { id: string; code: string }[]>();
    for (const n of all) {
      if (n.parentCode) {
        const arr = childMap.get(n.parentCode) ?? [];
        arr.push({ id: n.id, code: n.code });
        childMap.set(n.parentCode, arr);
      }
    }
    const descendantIds: string[] = [];
    const stack = [target.code];
    while (stack.length) {
      const cur = stack.pop() as string;
      for (const k of childMap.get(cur) ?? []) {
        descendantIds.push(k.id);
        stack.push(k.code);
      }
    }

    if (!enabled) {
      await this.prisma.serviceArea.updateMany({
        where: { id: { in: [id, ...descendantIds] } },
        data: { isActive: false },
      });
      return;
    }
    await this.prisma.serviceArea.update({
      where: { id },
      data: { isActive: true },
    });
    if (cascadeChildren && descendantIds.length) {
      await this.prisma.serviceArea.updateMany({
        where: { id: { in: descendantIds } },
        data: { isActive: true },
      });
    }
  }
}
