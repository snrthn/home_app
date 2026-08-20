import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';
import { ReportsService } from './reports.service';

// 管理端工作台：聚合统计（今日订单/待接/在线师傅/本月GMV/平台净收入）
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('dashboard')
  dashboard() {
    return this.reports.dashboard();
  }
}
