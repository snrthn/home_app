import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MastersService } from './masters.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';
import { CreateMasterDto, ApproveMasterDto, UpdateMasterMeDto } from './masters.dto';

@Controller('masters')
export class MastersController {
  constructor(private masters: MastersService) {}

  @Get()
  list(
    @Query('city') city?: string,
    @Query('status') status?: string,
    @Query('pendingOnly') pendingOnly?: string,
  ) {
    return this.masters.list(city, status, pendingOnly);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateMasterDto) {
    return this.masters.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveMasterDto) {
    return this.masters.approve(id, dto.status, dto.reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() body: { status: 'active' | 'disabled' },
  ) {
    if (body.status !== 'active' && body.status !== 'disabled') {
      throw new BadRequestException('非法的状态');
    }
    return this.masters.setStatus(id, body.status);
  }

  // 师傅本人完善专属资料（需 master 角色）
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Master)
  @Patch('me')
  updateMe(@Req() req: any, @Body() dto: UpdateMasterMeDto) {
    return this.masters.updateMe(req.user.sub, dto);
  }
}
