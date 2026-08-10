import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// pnpm 的 @prisma/client 是只读软链，生成客户端实际位于 node_modules/.prisma/client
import { ServiceType, ServiceItem } from '../../node_modules/.prisma/client';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async list(city?: string, type?: string): Promise<ServiceItem[]> {
    return this.prisma.serviceItem.findMany({
      where: {
        isActive: true,
        ...(city ? { city } : {}),
        ...(type ? { type: type as ServiceType } : {}),
      },
      include: { category: true },
    });
  }

  async create(dto: any): Promise<ServiceItem> {
    return this.prisma.serviceItem.create({ data: { ...dto } });
  }

  async update(id: string, dto: any): Promise<ServiceItem> {
    return this.prisma.serviceItem.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<ServiceItem> {
    return this.prisma.serviceItem.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
