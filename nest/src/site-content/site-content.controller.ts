import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SiteContentService } from './site-content.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';

// 管理端：按 key 读取 / 覆盖更新站点内容（仅管理员）
@Controller('admin/site-content')
export class SiteContentController {
  constructor(private s: SiteContentService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get(':key')
  get(@Param('key') key: string) {
    return this.s.getByKey(key);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @Put(':key')
  upsert(
    @Param('key') key: string,
    @Body() dto: { title?: string; contentHtml?: string },
  ) {
    return this.s.upsert(key, dto);
  }
}
