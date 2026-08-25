import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PermGuard } from '../common/perm.guard';
import { RequirePerm } from '../common/perm.decorator';
import { Role } from '@laoma/shared';
import { AuditService, OperationLogQuery } from './audit.service';

/**
 * 操作日志查询接口。仅持有 logs:view 权限的管理员可访问（@RequirePerm 真相源校验）。
 */
@ApiTags('审计日志')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
@Roles(Role.Admin)
export class AuditController {
  constructor(private audit: AuditService) {}

  @RequirePerm('logs:view')
  @ApiOperation({ summary: '查询操作日志' })
  @ApiQuery({ name: 'module', required: false, description: '模块' })
  @ApiQuery({ name: 'action', required: false, description: '操作' })
  @ApiQuery({ name: 'userId', required: false, description: '用户 ID' })
  @ApiQuery({ name: 'from', required: false, description: '起始时间（ISO datetime）' })
  @ApiQuery({ name: 'to', required: false, description: '结束时间（ISO datetime）' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页条数' })
  @Get()
  list(@Query() q: OperationLogQuery) {
    return this.audit.findMany(q);
  }
}
