import { Controller, Get, Post, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { InstallService } from './install.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.interface';

@ApiTags('系统安装')
@Controller('install')
export class InstallController {
  constructor(
    private readonly installService: InstallService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: '获取安装状态' })
  @Get('status')
  async getStatus() {
    return this.installService.getStatus();
  }

  @ApiOperation({ summary: '初始化系统（首次安装）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', example: '13800138000', description: '管理员手机号' },
        password: { type: 'string', example: 'admin123', description: '密码（至少 6 位）' },
        nickname: { type: 'string', example: '超级管理员', description: '昵称' },
      },
      required: ['phone', 'password'],
    },
  })
  @Post('init')
  async init(@Body() body: { phone: string; password: string; nickname?: string }) {
    if (!body.phone || body.phone.length < 3) {
      throw new BadRequestException('管理员手机号不合法');
    }
    if (!body.password || body.password.length < 6) {
      throw new BadRequestException('密码至少 6 位');
    }
    await this.installService.init(body.phone, body.password, body.nickname || '超级管理员');
    return { success: true, message: '系统初始化完成' };
  }

  @ApiOperation({ summary: '重置系统（管理员）' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'mode', enum: ['light', 'deep'], required: false, description: 'light=重置种子数据，deep=清空所有数据' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        password: { type: 'string', description: '当前管理员登录密码' },
      },
      required: ['password'],
    },
  })
  @UseGuards(JwtAuthGuard)
  @Post('reset')
  async reset(
    @Query('mode') mode: 'light' | 'deep',
    @Body() body: { password?: string },
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role !== 'admin') {
      throw new BadRequestException('仅管理员可执行系统重置');
    }
    if (!body.password) {
      throw new BadRequestException('请输入当前登录密码');
    }
    const admin = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!admin?.passwordHash) {
      throw new BadRequestException('管理员账号异常');
    }
    const ok = await bcrypt.compare(body.password, admin.passwordHash);
    if (!ok) {
      throw new BadRequestException('当前密码错误');
    }
    await this.installService.reset(mode || 'light');
    return { success: true, message: `系统已重置（${mode || 'light'} 模式）` };
  }
}
