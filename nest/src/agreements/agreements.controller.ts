import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { AgreementsService } from './agreements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';

// 管理端：协议的增删改�? / 版本 / 上架下架（仅管理员）
@ApiTags('协议管理')
@Controller('admin/agreements')
export class AgreementsController {
  constructor(private s: AgreementsService) {}

  // 新建协议类型（某�? + 某类型，唯一�?
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '新建协议类型' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: '端（customer/master/admin）' },
        type: { type: 'string', description: '协议类型（如 registration/privacy）' },
        title: { type: 'string', description: '协议标题' },
      },
      required: ['scope', 'type', 'title'],
    },
  })
  @Post()
  createTemplate(
    @CurrentUser() user: AuthUser,
    @Body() dto: { scope: string; type: string; title: string },
  ) {
    return this.s.createTemplate(user.sub, dto);
  }

  // 修改协议类型名称（创建后允许修正；不影响 code 与已有版本）
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '修改协议类型名称' })
  @ApiParam({ name: 'id', description: '协议模板 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '协议标题' },
      },
      required: ['title'],
    },
  })
  @Patch(':id')
  updateTemplate(@Param('id') id: string, @Body() dto: { title: string }) {
    return this.s.updateTemplate(id, dto);
  }

  // 列表（模�? + 各自全部版本/状�?/当前生效�?
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '协议模板列表' })
  @Get()
  listTemplates() {
    return this.s.listTemplates();
  }

  // 新建版本（草稿，版本号按模板�? max+1 自增�?
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '新建协议版本' })
  @ApiParam({ name: 'id', description: '协议模板 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '版本标题' },
        contentHtml: { type: 'string', description: '协议正文 HTML' },
      },
      required: ['title'],
    },
  })
  @Post(':id/versions')
  createVersion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: { title: string; contentHtml?: string },
  ) {
    return this.s.createVersion(user.sub, id, dto);
  }

  // 编辑版本（仅草稿可改；非草稿需新建版本后上架）
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '编辑协议版本' })
  @ApiParam({ name: 'id', description: '协议模板 ID' })
  @ApiParam({ name: 'vid', description: '协议版本 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '版本标题' },
        contentHtml: { type: 'string', description: '协议正文 HTML' },
      },
    },
  })
  @Patch(':id/versions/:vid')
  updateVersion(
    @Param('id') id: string,
    @Param('vid') vid: string,
    @Body() dto: { title?: string; contentHtml?: string },
  ) {
    return this.s.updateVersion(id, vid, dto);
  }

  // 上架：本版本生效（status=published, isCurrent=true），并取消其他版本的 current
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '上架协议版本' })
  @ApiParam({ name: 'id', description: '协议模板 ID' })
  @ApiParam({ name: 'vid', description: '协议版本 ID' })
  @Post(':id/versions/:vid/publish')
  publish(@Param('id') id: string, @Param('vid') vid: string) {
    return this.s.publish(id, vid);
  }

  // 下架：本版本失效（status=offline, isCurrent=false）；若无其他生效版本，公开页将无入�?
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @Audit('content', 'content:manage')
  @RequirePerm('content:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: '下架协议版本' })
  @ApiParam({ name: 'id', description: '协议模板 ID' })
  @ApiParam({ name: 'vid', description: '协议版本 ID' })
  @Post(':id/versions/:vid/offline')
  offline(@Param('id') id: string, @Param('vid') vid: string) {
    return this.s.offline(id, vid);
  }
}
