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
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

/**
 * 角色权限管理接口。仅 super_admin（持有 settings:role_manage）可访问。
 * 图层：JwtAuthGuard(鉴权) → RolesGuard(admin 入口闸门) → PermGuard(内部权限校验)。
 */
@ApiTags('权限管理')
@ApiBearerAuth()
@Controller('rbac')
@UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
@Roles(Role.Admin)
export class RbacController {
  constructor(private rbac: RbacService) {}

  @Audit('rbac', 'settings:role_manage')

  @RequirePerm('settings:role_manage')
  @ApiOperation({ summary: '权限列表' })
  @Get('permissions')
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @Audit('rbac', 'settings:role_manage')

  @RequirePerm('settings:role_manage')
  @ApiOperation({ summary: '角色列表' })
  @Get('roles')
  listRoles() {
    return this.rbac.listRoles();
  }

  @Audit('rbac', 'settings:role_manage')

  @RequirePerm('settings:role_manage')
  @ApiOperation({ summary: '获取角色详情' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @Get('roles/:id')
  getRole(@Param('id') id: string) {
    return this.rbac.getRole(id);
  }

  @Audit('rbac', 'settings:role_manage')

  @RequirePerm('settings:role_manage')
  @ApiOperation({ summary: '获取角色功能权限' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @Get('roles/:id/functions')
  getRoleFunctions(@Param('id') id: string) {
    return this.rbac.getRoleFunctions(id);
  }

  @Audit('rbac', 'settings:role_manage')

  @RequirePerm('settings:role_manage')
  @ApiOperation({ summary: '创建角色' })
  @Post('roles')
  createRole(
    @Body() body: { key: string; name: string; description?: string },
  ) {
    return this.rbac.createRole(body);
  }

  @Audit('rbac', 'settings:role_manage')

  @RequirePerm('settings:role_manage')
  @ApiOperation({ summary: '更新角色' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @Put('roles/:id')
  updateRole(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.rbac.updateRole(id, body);
  }

  @Audit('rbac', 'settings:role_manage')

  @RequirePerm('settings:role_manage')
  @ApiOperation({ summary: '删除角色' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.rbac.deleteRole(id);
  }

  @Audit('rbac', 'settings:role_manage')

  @RequirePerm('settings:role_manage')
  @ApiOperation({ summary: '设置角色权限' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @Put('roles/:id/permissions')
  setRolePermissions(
    @Param('id') id: string,
    @Body() body: { permissionCodes: string[] },
  ) {
    return this.rbac.setRolePermissions(id, body.permissionCodes);
  }
}
