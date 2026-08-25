import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

@ApiTags('用户管理')
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员列表' })
  @Get('admins')
  listAdmins() {
    return this.users.listAdmins();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '客户列表' })
  @Get('customers')
  listCustomers() {
    return this.users.listCustomers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('users', 'users:admin_manage')
  @RequirePerm('users:admin_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建管理员' })
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

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('users', 'users:admin_manage')
  @RequirePerm('users:admin_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新管理员' })
  @ApiParam({ name: 'id', description: '管理员用户ID' })
  @Patch('admins/:id')
  updateAdmin(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: { nickname?: string; password?: string; staffRoleId?: string },
  ) {
    // 防自锁死：禁止管理员把自己的 super_admin 角色改走（当前为 super_admin 且目标角色变更）
    if (
      id === user?.sub &&
      user?.staffRoleKey === 'super_admin' &&
      body.staffRoleId !== undefined &&
      body.staffRoleId !== user?.staffRoleId
    ) {
      throw new BadRequestException('不能修改自己的超级管理员角色');
    }
    return this.users.updateAdmin(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('users', 'users:admin_manage')
  @RequirePerm('users:admin_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '设置管理员状态' })
  @ApiParam({ name: 'id', description: '管理员用户ID' })
  @Post('admins/:id/status')
  setAdminStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    // 防自锁死：禁止管理员禁用 / 冻结自己的账号
    if (id === user?.sub) {
      throw new BadRequestException('不能禁用或冻结自己当前登录的账号');
    }
    return this.users.setAdminStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('users', 'users:customer_toggle')
  @RequirePerm('users:customer_toggle')
  @ApiBearerAuth()
  @ApiOperation({ summary: '设置客户状态' })
  @ApiParam({ name: 'id', description: '客户用户ID' })
  @Post('customers/:id/status')
  setCustomerStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.users.setCustomerStatus(id, body.status);
  }
}
