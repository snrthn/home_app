import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CommissionService } from './commission.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';
import { UpsertCommissionRuleDto } from './commission.dto';

/** 分账规则配置（管理端）。写操作统一挂 finance:manage 权限 + 审计。 */
@ApiTags('分账规则')
@Controller('commission')
export class CommissionController {
  constructor(private s: CommissionService) {}

  /** 规则列表（全局 / 类目 / 服务项三档，附作用对象名称） */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '分账规则列表' })
  @Get('rules')
  list() {
    return this.s.list();
  }

  /** 试算：给定服务项预览最终生效规则 + 各阶段退款三方分账 */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '分账试算' })
  @ApiQuery({ name: 'serviceItemId', description: '服务项 ID' })
  @ApiQuery({ name: 'amount', required: false, description: '金额（默认 100）' })
  @Get('preview')
  preview(
    @Query('serviceItemId') serviceItemId: string,
    @Query('amount') amount?: string,
  ) {
    return this.s.preview(serviceItemId, amount ? Number(amount) : 100);
  }

  /** 新增/更新规则（scope + refId 唯一） */
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('finance', 'finance:manage')
  @RequirePerm('finance:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '新增/更新分账规则' })
  @ApiBody({ type: UpsertCommissionRuleDto })
  @Put('rules')
  upsert(@Body() dto: UpsertCommissionRuleDto) {
    return this.s.upsert(dto);
  }

  /** 删除规则（软删；全局规则不可删） */
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('finance', 'finance:manage')
  @RequirePerm('finance:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除分账规则' })
  @ApiParam({ name: 'id', description: '规则 ID' })
  @Delete('rules/:id')
  remove(@Param('id') id: string) {
    return this.s.remove(id);
  }
}
