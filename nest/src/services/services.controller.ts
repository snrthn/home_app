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

// 管理端：服务类目 + 服务项目的增删改查（仅管理员）
@Controller('admin/services')
export class ServicesAdminController {
  constructor(private s: ServicesService) {}

  // ---------- 类目 ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get('categories')
  listCategories() {
    return this.s.listCategories();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get('categories/:id')
  getCategory(@Param('id') id: string) {
    return this.s.getCategory(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:category_manage')
  @RequirePerm('services:category_manage')
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.s.createCategory(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:category_manage')
  @RequirePerm('services:category_manage')
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.s.updateCategory(id, dto);
  }

  // 级联启停：停用整支向下传递；启用默认只开自身，cascadeChildren 时连带子孙
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:category_manage')
  @RequirePerm('services:category_manage')
  @Patch('categories/:id/active')
  setCategoryActive(@Param('id') id: string, @Body() dto: SetCategoryActiveDto) {
    return this.s.setCategoryEnabled(id, dto.enabled, dto.cascadeChildren);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:category_manage')
  @RequirePerm('services:category_manage')
  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.s.removeCategory(id);
  }

  // ---------- 项目 ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get('items')
  listItems(@Query('categoryId') categoryId?: string) {
    return this.s.listItems(categoryId ? { categoryId } : undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get('items/:id')
  getItem(@Param('id') id: string) {
    return this.s.getItem(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:item_manage')
  @RequirePerm('services:item_manage')
  @Post('items')
  createItem(@Body() dto: CreateServiceItemDto) {
    return this.s.createItem(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:item_manage')
  @RequirePerm('services:item_manage')
  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateServiceItemDto) {
    return this.s.updateItem(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:item_manage')
  @RequirePerm('services:item_manage')
  @Delete('items/:id')
  removeItem(@Param('id') id: string) {
    return this.s.removeItem(id);
  }
}

// 公开：服务类目 + 服务项目（下单/选服务时用，无需鉴权）
@Controller('services')
export class ServicesPublicController {
  constructor(private s: ServicesService) {}

  @Get('categories')
  listPublicCategories() {
    return this.s.listPublicCategories();
  }

  @Get('categories/tree')
  getCategoryTree() {
    return this.s.getCategoryTree();
  }

  @Get()
  listPublicItems() {
    return this.s.listPublicItems();
  }

  @Get(':id')
  getPublicItem(@Param('id') id: string) {
    return this.s.getItem(id);
  }
}
