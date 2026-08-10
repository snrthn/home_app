import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get('admins')
  listAdmins() {
    return this.users.listAdmins();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get('customers')
  listCustomers() {
    return this.users.listCustomers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post('admins')
  createAdmin(
    @Body() body: { phone: string; password: string; nickname?: string },
  ) {
    return this.users.createAdmin(body.phone, body.password, body.nickname);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch('admins/:id')
  updateAdmin(
    @Param('id') id: string,
    @Body() body: { nickname?: string; password?: string },
  ) {
    return this.users.updateAdmin(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post('admins/:id/status')
  setAdminStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.users.setAdminStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post('customers/:id/status')
  setCustomerStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.users.setCustomerStatus(id, body.status);
  }
}
