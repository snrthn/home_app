import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  SetCategoryActiveDto,
  CreateServiceItemDto,
  UpdateServiceItemDto,
} from './services.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';

// 管理端：服务类目 + 服务项目的增删改查（仅管理员）
@ApiTags('服务类目')
@Controller('admin/services')
export class ServicesAdminController {
  constructor(private s: ServicesService) {}

  // ---------- 类目 ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取类目列表' })
  @Get('categories')
  listCategories() {
    return this.s.listCategories();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取单个类目' })
  @ApiParam({ name: 'id', description: '类目ID' })
  @Get('categories/:id')
  getCategory(@Param('id') id: string) {
    return this.s.getCategory(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:category_manage')
  @RequirePerm('services:category_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建类目' })
  @ApiBody({ type: CreateCategoryDto })
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.s.createCategory(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:category_manage')
  @RequirePerm('services:category_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新类目' })
  @ApiParam({ name: 'id', description: '类目ID' })
  @ApiBody({ type: UpdateCategoryDto })
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.s.updateCategory(id, dto);
  }

  // 级联启停：停用整支向下传递；启用默认只开自身，cascadeChildren 时连带子孙
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:category_manage')
  @RequirePerm('services:category_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '级联启停类目' })
  @ApiParam({ name: 'id', description: '类目ID' })
  @ApiBody({ type: SetCategoryActiveDto })
  @Patch('categories/:id/active')
  setCategoryActive(@Param('id') id: string, @Body() dto: SetCategoryActiveDto) {
    return this.s.setCategoryEnabled(id, dto.enabled, dto.cascadeChildren);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:category_manage')
  @RequirePerm('services:category_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除类目' })
  @ApiParam({ name: 'id', description: '类目ID' })
  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.s.removeCategory(id);
  }

  // ---------- 项目 ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取服务项目列表' })
  @ApiQuery({ name: 'categoryId', required: false, description: '按类目筛选' })
  @Get('items')
  listItems(@Query('categoryId') categoryId?: string) {
    return this.s.listItems(categoryId ? { categoryId } : undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取单个服务项目' })
  @ApiParam({ name: 'id', description: '项目ID' })
  @Get('items/:id')
  getItem(@Param('id') id: string) {
    return this.s.getItem(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:item_manage')
  @RequirePerm('services:item_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建服务项目' })
  @ApiBody({ type: CreateServiceItemDto })
  @Post('items')
  createItem(@Body() dto: CreateServiceItemDto) {
    return this.s.createItem(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:item_manage')
  @RequirePerm('services:item_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新服务项目' })
  @ApiParam({ name: 'id', description: '项目ID' })
  @ApiBody({ type: UpdateServiceItemDto })
  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateServiceItemDto) {
    return this.s.updateItem(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:item_manage')
  @RequirePerm('services:item_manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除服务项目' })
  @ApiParam({ name: 'id', description: '项目ID' })
  @Delete('items/:id')
  removeItem(@Param('id') id: string) {
    return this.s.removeItem(id);
  }
}

// 公开：服务类目 + 服务项目（下单/选服务时用，无需鉴权）
@ApiTags('服务类目')
@Controller('services')
export class ServicesPublicController {
  constructor(private s: ServicesService) {}

  @ApiOperation({ summary: '获取公开类目列表' })
  @Get('categories')
  listPublicCategories() {
    return this.s.listPublicCategories();
  }

  @ApiOperation({ summary: '获取类目树' })
  @Get('categories/tree')
  getCategoryTree() {
    return this.s.getCategoryTree();
  }

  @ApiOperation({ summary: '获取公开服务项目列表' })
  @Get()
  listPublicItems() {
    return this.s.listPublicItems();
  }

  @ApiOperation({ summary: '获取单个公开服务项目' })
  @ApiParam({ name: 'id', description: '项目ID' })
  @Get(':id')
  getPublicItem(@Param('id') id: string) {
    return this.s.getItem(id);
  }
}
