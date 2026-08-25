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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
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
@ApiTags('区域管理')
@Controller('admin/services/areas')
export class AreasAdminController {
  constructor(private s: AreasService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '区域列表' })
  @Get()
  list() {
    return this.s.listAreas();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取区域详情' })
  @ApiParam({ name: 'id', description: '区域 ID' })
  @Get(':id')
  get(@Param('id') id: string) {
    return this.s.getArea(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:area_manage')
  @RequirePerm('services:area_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '新建区域' })
  @ApiBody({ type: CreateServiceAreaDto })
  @Post()
  create(@Body() dto: CreateServiceAreaDto) {
    return this.s.createArea(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:area_manage')
  @RequirePerm('services:area_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新区域' })
  @ApiParam({ name: 'id', description: '区域 ID' })
  @ApiBody({ type: UpdateServiceAreaDto })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceAreaDto) {
    return this.s.updateArea(id, dto);
  }

  // 级联启停：停用整支向下传递；启用默认只开自身，cascadeChildren 时连带子孙
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:area_manage')
  @RequirePerm('services:area_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '级联启停区域' })
  @ApiParam({ name: 'id', description: '区域 ID' })
  @ApiBody({ type: SetAreaActiveDto })
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: SetAreaActiveDto) {
    return this.s.setAreaEnabled(id, dto.enabled, dto.cascadeChildren);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:area_manage')
  @RequirePerm('services:area_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除区域' })
  @ApiParam({ name: 'id', description: '区域 ID' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.s.removeArea(id);
  }
}
