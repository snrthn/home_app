import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';
import { CreateWithdrawalDto, RejectWithdrawalDto } from './withdrawals.dto';

@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private s: WithdrawalsService) {}

  // ===== 师傅端 =====

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Master)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWithdrawalDto) {
    return this.s.create(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Master)
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.s.mine(user.sub);
  }

  // ===== 管理端 =====

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('finance:manage')
  @Get()
  list(@Query('status') status?: string) {
    return this.s.list(status);
  }

  /** 通过审核 → 线下打款 → 标记已打款（paid） */
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('finance', 'finance:manage')
  @RequirePerm('finance:manage')
  @Post(':id/pay')
  pay(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.s.markPaid(id, user.sub);
  }

  /** 驳回（解冻退回余额），必填原因 */
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('finance', 'finance:manage')
  @RequirePerm('finance:manage')
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectWithdrawalDto, @CurrentUser() user: AuthUser) {
    return this.s.reject(id, user.sub, dto.reason);
  }
}
