import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { AddressesService, type AddressInput } from './addresses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';

@ApiTags('地址管理')
@Controller('addresses')
export class AddressesController {
  constructor(private addresses: AddressesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Customer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我的地址列表' })
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.addresses.listMine(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Customer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '新建地址' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contactName: { type: 'string', description: '联系人姓名' },
        contactPhone: { type: 'string', description: '联系人电话' },
        province: { type: 'string', description: '省份' },
        provinceCode: { type: 'string', description: '省份编码' },
        city: { type: 'string', description: '城市' },
        cityCode: { type: 'string', description: '城市编码' },
        district: { type: 'string', description: '区/县' },
        districtCode: { type: 'string', description: '区/县编码' },
        detail: { type: 'string', description: '详细地址' },
        tag: { type: 'string', description: '标签' },
        isDefault: { type: 'boolean', description: '是否默认地址' },
      },
      required: ['contactName', 'contactPhone', 'city', 'detail'],
    },
  })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: AddressInput) {
    return this.addresses.create(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Customer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新地址' })
  @ApiParam({ name: 'id', description: '地址 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contactName: { type: 'string' },
        contactPhone: { type: 'string' },
        province: { type: 'string' },
        provinceCode: { type: 'string' },
        city: { type: 'string' },
        cityCode: { type: 'string' },
        district: { type: 'string' },
        districtCode: { type: 'string' },
        detail: { type: 'string' },
        tag: { type: 'string' },
        isDefault: { type: 'boolean' },
      },
    },
  })
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: Partial<AddressInput>) {
    return this.addresses.update(user.sub, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Customer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除地址' })
  @ApiParam({ name: 'id', description: '地址 ID' })
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addresses.remove(user.sub, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Customer)
  @ApiBearerAuth()
  @ApiOperation({ summary: '设为默认地址' })
  @ApiParam({ name: 'id', description: '地址 ID' })
  @Post(':id/default')
  setDefault(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addresses.setDefault(user.sub, id);
  }
}
