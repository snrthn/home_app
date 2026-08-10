import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';
import { CreateOrderDto, AssignDto } from './orders.dto';

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post()
  create(@Req() req: any, @Body() dto: CreateOrderDto) {
    return this.orders.create(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Get('mine')
  mine(@Req() req: any) {
    return this.orders.listForCustomer(req.user.sub);
  }

  @Get('pool')
  pool(@Query('city') city?: string) {
    return this.orders.pool(city);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Get('master')
  masterOrders(@Req() req: any, @Query('city') city?: string) {
    return this.orders.listForMaster(req.user.sub, city);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Get('all')
  all() {
    return this.orders.listAll();
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/grab')
  grab(@Param('id') id: string, @Req() req: any) {
    return this.orders.grab(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Post(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignDto,
    @Req() req: any,
  ) {
    return this.orders.assign(id, dto.masterId, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/start')
  start(@Param('id') id: string, @Req() req: any) {
    return this.orders.startService(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Master)
  @Post(':id/complete')
  complete(@Param('id') id: string, @Req() req: any) {
    return this.orders.complete(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post(':id/pay')
  pay(@Param('id') id: string, @Req() req: any) {
    return this.orders.pay(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.orders.cancel(id, req.user.sub);
  }
}
