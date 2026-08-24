import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';
import { CreateOrderDto, AssignDto, ArriveDto, CancelOrderDto } from './orders.dto';

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.listForCustomer(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Get('pool')
  pool(@CurrentUser() user: AuthUser) {
    return this.orders.pool(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Get('master')
  masterOrders(@CurrentUser() user: AuthUser, @Query('city') city?: string) {
    return this.orders.listForMaster(user.sub, city);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Get('all')
  all() {
    return this.orders.listAll();
  }

  // 派单看板统计（Phase 2）：待派/超时/在岗师傅/今日已派/平均接单时长
  @UseGuards(JwtAuthGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('dispatch:smart')
  @Get('dispatch/stats')
  dispatchStats() {
    return this.orders.dispatchStats();
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/grab')
  grab(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.grab(id, user.sub);
  }

  @UseGuards(JwtAuthGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('orders', 'orders:edit')
  @RequirePerm('orders:edit')
  @Post(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orders.assign(id, dto.masterId, user.sub);
  }

  @UseGuards(JwtAuthGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('dispatch:smart')
  @Get(':id/candidates')
  candidates(@Param('id') id: string) {
    return this.orders.listCandidates(id);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/depart')
  depart(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.depart(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post(':id/generate-arrive-code')
  generateArriveCode(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.generateArriveCode(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/arrive')
  arrive(
    @Param('id') id: string,
    @Body() dto: ArriveDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orders.arrive(id, user.sub, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.startService(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.complete(id, user.sub);
  }

  // 客户验收：待验收 → 已评价（释放托管金），替代旧「评价即终态」
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.confirm(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancel(
      id,
      user.sub,
      user.role === 'admin',
      dto.reason,
    );
  }
}
