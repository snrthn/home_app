import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';
import { ReportsService } from './reports.service';

// 管理端报表：工作台聚合 / 经营报表 / 师傅绩效 / 用户增长
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('dashboard')
  dashboard() {
    return this.reports.dashboard();
  }

  // 经营报表：dimension=day|week|month，start/end ISO 日期，默认近 30 天
  @Get('business')
  business(@Query() q: { dimension?: string; start?: string; end?: string }) {
    return this.reports.business(q);
  }

  // 师傅绩效：sort=orders|revenue|rating|completion，limit 默认 20，start/end 可选（默认全历史）
  @Get('performance')
  performance(
    @Query() q: { start?: string; end?: string; sort?: string; limit?: string },
  ) {
    return this.reports.performance(q);
  }

  // 用户增长：dimension=day|week|month，start/end 可选，默认近 30 天
  @Get('growth')
  growth(@Query() q: { dimension?: string; start?: string; end?: string }) {
    return this.reports.growth(q);
  }
}
