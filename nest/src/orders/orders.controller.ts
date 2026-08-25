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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CreateOrderDto, AssignDto, ArriveDto, CancelOrderDto } from './orders.dto';

@ApiTags('订单管理')
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @ApiOperation({ summary: '创建订单' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateOrderDto })
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.sub, dto);
  }

  @ApiOperation({ summary: '我的订单' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.listForCustomer(user.sub);
  }

  @ApiOperation({ summary: '抢单池' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Get('pool')
  pool(@CurrentUser() user: AuthUser) {
    return this.orders.pool(user.sub);
  }

  @ApiOperation({ summary: '师傅订单列表' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'city', required: false })
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Get('master')
  masterOrders(@CurrentUser() user: AuthUser, @Query('city') city?: string) {
    return this.orders.listForMaster(user.sub, city);
  }

  @ApiOperation({ summary: '全部订单' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Get('all')
  all() {
    return this.orders.listAll();
  }

  // 派单看板统计（Phase 2）：待派/超时/在岗师傅/今日已派/平均接单时长
  @ApiOperation({ summary: '派单看板统计' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('dispatch:smart')
  @Get('dispatch/stats')
  dispatchStats() {
    return this.orders.dispatchStats();
  }

  @ApiOperation({ summary: '抢单' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/grab')
  grab(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.grab(id, user.sub);
  }

  @ApiOperation({ summary: '指派师傅' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @ApiBody({ type: AssignDto })
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

  @ApiOperation({ summary: '候选师傅列表' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @UseGuards(JwtAuthGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('dispatch:smart')
  @Get(':id/candidates')
  candidates(@Param('id') id: string) {
    return this.orders.listCandidates(id);
  }

  @ApiOperation({ summary: '师傅出发' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/depart')
  depart(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.depart(id, user.sub);
  }

  @ApiOperation({ summary: '生成到达验证码' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post(':id/generate-arrive-code')
  generateArriveCode(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.generateArriveCode(id, user.sub);
  }

  @ApiOperation({ summary: '师傅到达' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ArriveDto })
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

  @ApiOperation({ summary: '开始服务' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.startService(id, user.sub);
  }

  @ApiOperation({ summary: '完成服务' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.complete(id, user.sub);
  }

  // 客户验收：待验收 → 已评价（释放托管金），替代旧「评价即终态」
  @ApiOperation({ summary: '客户验收' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.confirm(id, user.sub);
  }

  @ApiOperation({ summary: '取消订单' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @ApiBody({ type: CancelOrderDto })
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
