import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';

@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post()
  create(@Req() req: any, @Body() dto: { orderId: string; qrType: string; proofUrl?: string }) {
    return this.payments.create(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Req() req: any) {
    return this.payments.confirm(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Get()
  list() {
    return this.payments.list();
  }
}
