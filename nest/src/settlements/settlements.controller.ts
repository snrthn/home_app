import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RejectSettlementDto, CreditSettlementDto } from './settlements.dto';

@Controller('settlements')
export class SettlementsController {
  constructor(
    private s: SettlementsService,
    private prisma: PrismaService,
  ) {}

  // ===== 师傅端：收入汇总 / 明细 =====

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Master)
  @Get('summary')
  async summary(@Req() req: any) {
    const master = await this.prisma.master.findUnique({
      where: { userId: req.user.sub },
    });
    if (!master) return {};
    return this.s.masterSummary(master.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Master)
  @Get('mine')
  async mine(@Req() req: any) {
    const master = await this.prisma.master.findUnique({
      where: { userId: req.user.sub },
    });
    if (!master) return [];
    return this.s.masterList(master.id);
  }

  // ===== 管理端 =====

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get()
  list() {
    return this.s.list();
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Post('sync')
  sync() {
    return this.s.syncForPaidOrders();
  }

  /** 补偿单确认入账（pending → credited，金额进入师傅余额） */
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('finance', 'finance:manage')
  @RequirePerm('finance:manage')
  @Post(':id/credit')
  credit(@Param('id') id: string, @Body() dto: CreditSettlementDto) {
    return this.s.credit(id, dto.note);
  }

  /** 补偿单驳回（pending → rejected，需填原因） */
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('finance', 'finance:manage')
  @RequirePerm('finance:manage')
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectSettlementDto) {
    return this.s.reject(id, dto.reason);
  }
}
