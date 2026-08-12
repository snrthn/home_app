import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AreasService } from './areas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';
import { CreateServiceAreaDto, UpdateServiceAreaDto, SetAreaActiveDto } from './areas.dto';

// 管理端：服务区域（开通城市字典）的增删改查（仅管理员）
@Controller('admin/services/areas')
export class AreasAdminController {
  constructor(private s: AreasService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get()
  list() {
    return this.s.listAreas();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get(':id')
  get(@Param('id') id: string) {
    return this.s.getArea(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:area_manage')
  @RequirePerm('services:area_manage')
  @Post()
  create(@Body() dto: CreateServiceAreaDto) {
    return this.s.createArea(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:area_manage')
  @RequirePerm('services:area_manage')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceAreaDto) {
    return this.s.updateArea(id, dto);
  }

  // 级联启停：停用整支向下传递；启用默认只开自身，cascadeChildren 时连带子孙
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:area_manage')
  @RequirePerm('services:area_manage')
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: SetAreaActiveDto) {
    return this.s.setAreaEnabled(id, dto.enabled, dto.cascadeChildren);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:area_manage')
  @RequirePerm('services:area_manage')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.s.removeArea(id);
  }
}
