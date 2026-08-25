import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('评价管理')
@Controller('reviews')
export class ReviewsController {
  constructor(private r: ReviewsService) {}

  @ApiOperation({ summary: '创建评价' })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        rating: { type: 'number' },
        comment: { type: 'string' },
        anonymous: { type: 'boolean' },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    dto: { orderId: string; rating: number; comment?: string; anonymous?: boolean },
  ) {
    return this.r.create(user.sub, dto);
  }

  @ApiOperation({ summary: '评价列表' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Get()
  listAll() {
    return this.r.listAll();
  }

  @ApiOperation({ summary: '师傅评价列表' })
  @ApiParam({ name: 'id' })
  @Get('master/:id')
  listByMaster(@Param('id') id: string) {
    return this.r.listByMaster(id);
  }
}
