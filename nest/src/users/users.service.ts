import { Injectable } from '@nestjs/common';
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

  async createAdmin(phone: string, password: string, nickname?: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        phone,
        passwordHash,
        role: 'admin',
        profile: { create: { nickname: nickname || `管理员${phone.slice(-4)}` } },
      },
    });
  }
}
