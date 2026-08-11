import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
  BadRequestException,
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
    @Body()
    body: { phone: string; password: string; nickname?: string; staffRoleId?: string },
  ) {
    return this.users.createAdmin(
      body.phone,
      body.password,
      body.nickname,
      body.staffRoleId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch('admins/:id')
  updateAdmin(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: { nickname?: string; password?: string; staffRoleId?: string },
  ) {
    // 防自锁死：禁止管理员把自己的 super_admin 角色改走（当前为 super_admin 且目标角色变更）
    if (
      id === req.user?.sub &&
      req.user?.staffRoleKey === 'super_admin' &&
      body.staffRoleId !== undefined &&
      body.staffRoleId !== req.user?.staffRoleId
    ) {
      throw new BadRequestException('不能修改自己的超级管理员角色');
    }
    return this.users.updateAdmin(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post('admins/:id/status')
  setAdminStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    // 防自锁死：禁止管理员禁用 / 冻结自己的账号
    if (id === req.user?.sub) {
      throw new BadRequestException('不能禁用或冻结自己当前登录的账号');
    }
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
