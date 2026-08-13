import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AddressesService, type AddressInput } from './addresses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';

@Controller('addresses')
export class AddressesController {
  constructor(private addresses: AddressesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Customer)
  @Get()
  list(@Req() req: any) {
    return this.addresses.listMine(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Customer)
  @Post()
  create(@Req() req: any, @Body() dto: AddressInput) {
    return this.addresses.create(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Customer)
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<AddressInput>) {
    return this.addresses.update(req.user.sub, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Customer)
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.addresses.remove(req.user.sub, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Customer)
  @Post(':id/default')
  setDefault(@Req() req: any, @Param('id') id: string) {
    return this.addresses.setDefault(req.user.sub, id);
  }
}
