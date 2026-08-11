import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PermGuard } from '../common/perm.guard';
import { RequirePerm } from '../common/perm.decorator';
import { Role } from '@laoma/shared';

/**
 * 角色权限管理接口。仅 super_admin（持有 settings:role_manage）可访问。
 * 图层：JwtAuthGuard(鉴权) → RolesGuard(admin 入口闸门) → PermGuard(内部权限校验)。
 */
@Controller('rbac')
@UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
@Roles(Role.Admin)
export class RbacController {
  constructor(private rbac: RbacService) {}

  @RequirePerm('settings:role_manage')
  @Get('permissions')
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @RequirePerm('settings:role_manage')
  @Get('roles')
  listRoles() {
    return this.rbac.listRoles();
  }

  @RequirePerm('settings:role_manage')
  @Get('roles/:id')
  getRole(@Param('id') id: string) {
    return this.rbac.getRole(id);
  }

  @RequirePerm('settings:role_manage')
  @Get('roles/:id/functions')
  getRoleFunctions(@Param('id') id: string) {
    return this.rbac.getRoleFunctions(id);
  }

  @RequirePerm('settings:role_manage')
  @Post('roles')
  createRole(
    @Body() body: { key: string; name: string; description?: string },
  ) {
    return this.rbac.createRole(body);
  }

  @RequirePerm('settings:role_manage')
  @Put('roles/:id')
  updateRole(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.rbac.updateRole(id, body);
  }

  @RequirePerm('settings:role_manage')
  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.rbac.deleteRole(id);
  }

  @RequirePerm('settings:role_manage')
  @Put('roles/:id/permissions')
  setRolePermissions(
    @Param('id') id: string,
    @Body() body: { permissionCodes: string[] },
  ) {
    return this.rbac.setRolePermissions(id, body.permissionCodes);
  }
}
