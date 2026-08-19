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

  /** 按订单查结算单（含退款补偿单），三端订单详情展示补偿说明用 */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Customer, Role.Master, Role.Admin)
  @Get('by-order/:orderId')
  async byOrder(@Req() req: any, @Param('orderId') orderId: string) {
    // 权限：仅订单相关方（客户/师傅本人）或管理员可见，防止跨单窥探
    if (req.user.role !== Role.Admin) {
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return [];
      if (req.user.role === Role.Master) {
        const master = await this.prisma.master.findUnique({
          where: { userId: req.user.sub },
        });
        if (!master || order.masterId !== master.id) return [];
      } else if (order.customerId !== req.user.sub) {
        return [];
      }
    }
    return this.s.byOrder(orderId);
  }

  /** 补偿单确认入账（pending → credited，金额进入师傅余额） */
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('finance', 'finance:manage')
  @RequirePerm('finance:manage')
  @Post(':id/credit')
  credit(@Req() req: any, @Param('id') id: string, @Body() dto: CreditSettlementDto) {
    return this.s.credit(id, dto.note, req.user.sub);
  }

  /** 补偿单驳回（pending → rejected，需填原因） */
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('finance', 'finance:manage')
  @RequirePerm('finance:manage')
  @Post(':id/reject')
  reject(@Req() req: any, @Param('id') id: string, @Body() dto: RejectSettlementDto) {
    return this.s.reject(id, dto.reason, req.user.sub);
  }
}
