import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SystemConfigDto {
  siteName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  customerServicePhone: string | null;
}

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  // 单例读取：不存在则 upsert 默认行（保证 GET 永远有值，无需前端判空分支）
  async getGlobal(): Promise<SystemConfigDto> {
    const cfg = await this.prisma.systemConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, siteName: '老马家电' },
    });
    return this.toDto(cfg);
  }

  // 单例更新：部分字段，未传字段保持不变；create 兜底防止并发下首写缺失
  async updateGlobal(dto: {
    siteName?: string;
    logoUrl?: string;
    primaryColor?: string;
    customerServicePhone?: string;
  }): Promise<SystemConfigDto> {
    const cfg = await this.prisma.systemConfig.upsert({
      where: { id: 1 },
      update: {
        ...(dto.siteName !== undefined ? { siteName: dto.siteName } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor } : {}),
        ...(dto.customerServicePhone !== undefined
          ? { customerServicePhone: dto.customerServicePhone }
          : {}),
      },
      create: {
        id: 1,
        siteName: dto.siteName ?? '老马家电',
        logoUrl: dto.logoUrl ?? null,
        primaryColor: dto.primaryColor ?? null,
        customerServicePhone: dto.customerServicePhone ?? null,
      },
    });
    return this.toDto(cfg);
  }

  private toDto(c: {
    siteName: string;
    logoUrl: string | null;
    primaryColor: string | null;
    customerServicePhone: string | null;
  }): SystemConfigDto {
    return {
      siteName: c.siteName,
      logoUrl: c.logoUrl,
      primaryColor: c.primaryColor,
      customerServicePhone: c.customerServicePhone,
    };
  }
}
