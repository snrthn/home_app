import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMasterMeDto } from './masters.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class MastersService {
  constructor(private prisma: PrismaService) {}

  async list(city?: string, status?: string, pendingOnly?: string) {
    const where: Record<string, unknown> = {};
    if (city) where.city = city;
    if (pendingOnly === 'true') where.status = 'pending';
    else if (status) where.status = status;
    return this.prisma.master.findMany({
      where,
      include: { user: { select: { phone: true, profile: { select: { nickname: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: {
    phone: string;
    realName: string;
    city: string;
    idCard?: string;
    skills?: any;
    password?: string;
  }) {
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : null;
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: dto.phone,
          passwordHash,
          role: 'master',
          profile: { create: { nickname: dto.realName } },
        },
      });
      return tx.master.create({
        data: {
          userId: user.id,
          realName: dto.realName,
          city: dto.city,
          idCard: dto.idCard,
          skills: dto.skills ?? undefined,
          status: 'pending',
        },
      });
    });
  }

  async approve(id: string, status: 'active' | 'disabled', reason?: string) {
    // 审核通过时一并标记已实名认证（idVerified），使「已认证师傅」状态可体现
    const data: { status: 'active' | 'disabled'; idVerified?: boolean; rejectReason?: string | null } = { status };
    if (status === 'active') {
      data.idVerified = true;
      data.rejectReason = null; // 通过时清空历史拒绝理由
    } else if (reason !== undefined) {
      data.rejectReason = reason || null;
    }
    return this.prisma.master.update({ where: { id }, data });
  }

  // 启用 / 停用（仅 active/disabled，pending 走审核流程）
  async setStatus(id: string, status: 'active' | 'disabled') {
    return this.prisma.master.update({ where: { id }, data: { status } });
  }

  // 师傅完善自身专属资料（实名/身份证/技能/服务区域），按当前登录用户的 userId 定位
  async updateMe(userId: string, dto: UpdateMasterMeDto) {
    const master = await this.prisma.master.findUnique({ where: { userId } });
    if (!master) throw new NotFoundException('师傅资料不存在');
    const fields = [
      'realName',
      'idCard',
      'skills',
      'province',
      'provinceCode',
      'city',
      'cityCode',
      'district',
      'districtCode',
    ] as const;
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const v = (dto as Record<string, unknown>)[f];
      if (v === undefined || v === '') continue;
      data[f] = v;
    }
    if (Object.keys(data).length === 0) return master;
    return this.prisma.master.update({ where: { id: master.id }, data });
  }
}
