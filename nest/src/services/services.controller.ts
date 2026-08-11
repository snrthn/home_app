import {
  Controller,
  Get,
  Post,
  Put,
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
import { CreateServiceItemDto } from './services.dto';

@Controller('services')
export class ServicesController {
  constructor(private services: ServicesService) {}

  @Get()
  list(@Query('city') city?: string, @Query('type') type?: string) {
    return this.services.list(city, type);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:category_manage')
  @RequirePerm('services:category_manage')
  @Post()
  create(@Body() dto: CreateServiceItemDto) {
    return this.services.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:category_manage')
  @RequirePerm('services:category_manage')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.services.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('services', 'services:category_manage')
  @RequirePerm('services:category_manage')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.services.remove(id);
  }
}
