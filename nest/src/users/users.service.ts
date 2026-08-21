import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async listAdmins() {
    return this.prisma.user.findMany({
      where: { role: 'admin' },
      select: {
        id: true,
        phone: true,
        status: true,
        createdAt: true,
        profile: { select: { nickname: true } },
        staffRole: { select: { id: true, key: true, name: true } },
      },
    });
  }

  // 客户列表：role=customer，含资料画像与订单数（数据量小，最多取 200 条，前端再做关键词过滤）
  async listCustomers() {
    return this.prisma.user.findMany({
      where: { role: 'customer', deletedAt: null },
      include: {
        profile: true,
        _count: { select: { customerOrders: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createAdmin(
    phone: string,
    password: string,
    nickname?: string,
    staffRoleId?: string,
  ) {
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        phone,
        passwordHash,
        role: 'admin',
        ...(staffRoleId
          ? { staffRole: { connect: { id: staffRoleId } } }
          : {}),
        profile: { create: { nickname: nickname || `管理员${phone.slice(-4)}` } },
      },
    });
  }

  async updateAdmin(
    id: string,
    dto: { nickname?: string; password?: string; staffRoleId?: string },
  ) {
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;
    const data: Record<string, unknown> = {};
    if (passwordHash) data.passwordHash = passwordHash;
    if (dto.nickname !== undefined) {
      data.profile = {
        upsert: {
          where: { userId: id },
          create: { nickname: dto.nickname },
          update: { nickname: dto.nickname },
        },
      };
    }
    if (dto.staffRoleId !== undefined) {
      data.staffRole = dto.staffRoleId
        ? { connect: { id: dto.staffRoleId } }
        : { disconnect: true };
    }
    return this.prisma.user.update({ where: { id, role: 'admin' }, data });
  }

  async setAdminStatus(id: string, status: string) {
    const allowed = ['active', 'disabled', 'frozen'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`非法的账号状态: ${status}`);
    }
    // 超级管理员（根账号）不可被禁用 / 冻结，避免后台锁死、无人可恢复
    const target = await this.prisma.user.findUnique({
      where: { id, role: 'admin' },
      select: { staffRole: { select: { key: true } } },
    });
    if (target?.staffRole?.key === 'super_admin') {
      throw new BadRequestException('超级管理员账号不可被禁用或冻结');
    }
    return this.prisma.user.update({ where: { id, role: 'admin' }, data: { status } });
  }

  async setCustomerStatus(id: string, status: string) {
    const allowed = ['active', 'disabled', 'frozen'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`非法的账号状态: ${status}`);
    }
    return this.prisma.user.update({
      where: { id, role: 'customer' },
      data: { status },
    });
  }
}
