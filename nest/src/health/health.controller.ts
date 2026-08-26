import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // 存活检查：进程存活即可，不依赖外部服务。
  // PM2 / Nginx 用此端点判断是否需要重启或摘除流量。
  @Get('live')
  live() {
    return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };
  }

  // 就绪检查：数据库连通才能接流量，否则 Nginx 应返回 502。
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'error', database: 'down', timestamp: new Date().toISOString() };
    }
  }
}
