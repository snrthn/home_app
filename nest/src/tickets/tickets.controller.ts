import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
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
  CreateTicketDto,
  AddCommentDto,
  AppealDto,
  ResolveComplaintDto,
} from './tickets.dto';
import type { TicketListFilter } from './tickets.service';

// 工单底座：提交对全端开放（登录即可）；列表/改派/流转/处置走管理端权限。
@Controller('tickets')
export class TicketsController {
  constructor(private s: TicketsService) {}

  // 客户端/师傅提交工单（投诉校验已完成订单）
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.s.createTicket(user.sub, dto);
  }

  // 工单池列表（管理端，tickets:manage）
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('tickets:manage')
  @Get()
  list(@Query() q: TicketListFilter) {
    return this.s.list(q);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.s.listMine(user.sub, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.s.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  addComment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddCommentDto) {
    return this.s.addComment(user.sub, id, dto);
  }

  // 师傅申诉（对外留言，客服可见）
  @UseGuards(JwtAuthGuard)
  @Post(':id/appeal')
  @Audit('tickets', 'appeal')
  appeal(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AppealDto) {
    return this.s.appeal(user.sub, id, dto);
  }

  // 改派受理人（管理端）
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('tickets:manage')
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body('assigneeId') assigneeId: string) {
    return this.s.assign(id, assigneeId);
  }

  // 状态流转（管理端）
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('tickets:manage')
  @Audit('tickets', 'tickets:manage')
  @Post(':id/status')
  changeStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.s.changeStatus(id, status);
  }

  // 投诉处置（结果四选一，联动退款/补偿）
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('complaints:handle')
  @Audit('tickets', 'complaints:handle')
  @Post(':id/complaint/resolve')
  resolveComplaint(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ResolveComplaintDto) {
    return this.s.resolveComplaint(user.sub, id, dto);
  }
}
