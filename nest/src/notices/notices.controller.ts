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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

// 管理端：公告的增删改查 / 发布 / 下线（仅管理员）
@ApiTags('公告管理')
@Controller('admin/notices')
export class NoticesController {
  constructor(private s: NoticesService) {}

  // 列表（含草稿/已下线），可选 ?scope 过滤
  @ApiOperation({ summary: '公告列表（管理端）' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'scope', required: false })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get()
  list(@Query('scope') scope?: string) {
    return this.s.list(scope ? { scope } : undefined);
  }

  @ApiOperation({ summary: '获取公告详情' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.s.getById(id);
  }

  // 新建（默认草稿）
  @ApiOperation({ summary: '新建公告' })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        scope: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        contentHtml: { type: 'string' },
        pinned: { type: 'boolean' },
        startAt: { type: 'string' },
        endAt: { type: 'string' },
        targetRegions: { type: 'array', items: { type: 'object' } },
      },
    },
  })
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
  @ApiOperation({ summary: '编辑公告' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        scope: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        contentHtml: { type: 'string' },
        pinned: { type: 'boolean' },
        startAt: { type: 'string', nullable: true },
        endAt: { type: 'string', nullable: true },
        targetRegions: { type: 'array', items: { type: 'object' } },
      },
    },
  })
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
  @ApiOperation({ summary: '发布公告' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.s.publish(id);
  }

  // 下线：status=offline（公开页不再展示）
  @ApiOperation({ summary: '下线公告' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @Post(':id/offline')
  offline(@Param('id') id: string) {
    return this.s.offline(id);
  }

  // 删除（硬删；公告无版本依赖，删除即移除）
  @ApiOperation({ summary: '删除公告' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.s.remove(id);
  }
}
