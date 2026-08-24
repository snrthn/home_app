import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MastersService } from './masters.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
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

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('masters', 'users:master_verify')
  @RequirePerm('users:master_verify')
  @Post()
  create(@Body() dto: CreateMasterDto) {
    return this.masters.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('masters', 'users:master_verify')
  @RequirePerm('users:master_verify')
  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveMasterDto) {
    return this.masters.approve(id, dto.status, dto.reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('masters', 'users:master_toggle')
  @RequirePerm('users:master_toggle')
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
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMasterMeDto) {
    return this.masters.updateMe(user.sub, dto);
  }
}
