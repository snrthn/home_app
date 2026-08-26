import { Controller, Get, Post, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InstallService } from './install.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.interface';

@ApiTags('系统安装')
@Controller('install')
export class InstallController {
  constructor(private readonly installService: InstallService) {}

  @ApiOperation({ summary: '获取安装状态' })
  @Get('status')
  async getStatus() {
    return this.installService.getStatus();
  }

  @ApiOperation({ summary: '初始化系统（首次安装）' })
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
  @UseGuards(JwtAuthGuard)
  @Post('reset')
  async reset(
    @Query('mode') mode: 'light' | 'deep',
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role !== 'admin') {
      throw new BadRequestException('仅管理员可执行系统重置');
    }
    await this.installService.reset(mode || 'light');
    return { success: true, message: `系统已重置（${mode || 'light'} 模式）` };
  }
}
