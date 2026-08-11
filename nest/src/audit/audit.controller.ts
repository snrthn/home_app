import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
@Roles(Role.Admin)
export class AuditController {
  constructor(private audit: AuditService) {}

  @RequirePerm('logs:view')
  @Get()
  list(@Query() q: OperationLogQuery) {
    return this.audit.findMany(q);
  }
}
