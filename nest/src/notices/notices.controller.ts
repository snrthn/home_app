import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { NoticesService } from './notices.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';

// 管理端：公告的增删改查 / 发布 / 下线（仅管理员）
@Controller('admin/notices')
export class NoticesController {
  constructor(private s: NoticesService) {}

  // 列表（含草稿/已下线），可选 ?scope 过滤
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get()
  list(@Query('scope') scope?: string) {
    return this.s.list(scope ? { scope } : undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.s.getById(id);
  }

  // 新建（默认草稿）
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    dto: {
      scope: string;
      title: string;
      summary?: string;
      contentHtml?: string;
      pinned?: boolean;
      startAt?: string;
      endAt?: string;
      targetRegions?: any[];
    },
  ) {
    return this.s.create(user.sub, dto);
  }

  // 编辑（标题/正文/所属端/时间窗等）
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      scope?: string;
      title?: string;
      summary?: string;
      contentHtml?: string;
      pinned?: boolean;
      startAt?: string | null;
      endAt?: string | null;
      targetRegions?: any[];
    },
  ) {
    return this.s.update(id, dto);
  }

  // 发布：status=published，并记录发布时间
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.s.publish(id);
  }

  // 下线：status=offline（公开页不再展示）
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @Post(':id/offline')
  offline(@Param('id') id: string) {
    return this.s.offline(id);
  }

  // 删除（硬删；公告无版本依赖，删除即移除）
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.s.remove(id);
  }
}
