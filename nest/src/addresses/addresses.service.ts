import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AddressInput {
  contactName: string;
  contactPhone: string;
  province?: string | null;
  city: string;
  district?: string | null;
  detail: string;
  tag?: string | null;
  isDefault?: boolean;
}

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: AddressInput) {
    if (dto.isDefault) await this.clearDefault(userId);
    return this.prisma.address.create({
      data: {
        userId,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        province: dto.province ?? null,
        city: dto.city,
        district: dto.district ?? null,
        detail: dto.detail,
        tag: dto.tag ?? null,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(userId: string, id: string, dto: Partial<AddressInput>) {
    const addr = await this.prisma.address.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!addr) throw new NotFoundException('地址不存在');
    if (dto.isDefault) await this.clearDefault(userId);
    return this.prisma.address.update({
      where: { id },
      data: {
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        province: dto.province,
        city: dto.city,
        district: dto.district,
        detail: dto.detail,
        tag: dto.tag,
        isDefault: dto.isDefault ?? addr.isDefault,
      },
    });
  }

  async remove(userId: string, id: string) {
    const addr = await this.prisma.address.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!addr) throw new NotFoundException('地址不存在');
    await this.prisma.address.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id };
  }

  async setDefault(userId: string, id: string) {
    const addr = await this.prisma.address.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!addr) throw new NotFoundException('地址不存在');
    await this.clearDefault(userId);
    return this.prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  private clearDefault(userId: string) {
    return this.prisma.address.updateMany({
      where: { userId, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });
  }
}
