import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';

@Controller('reviews')
export class ReviewsController {
  constructor(private r: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post()
  create(
    @Req() req: any,
    @Body()
    dto: { orderId: string; rating: number; comment?: string; anonymous?: boolean },
  ) {
    return this.r.create(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Get()
  listAll() {
    return this.r.listAll();
  }

  @Get('master/:id')
  listByMaster(@Param('id') id: string) {
    return this.r.listByMaster(id);
  }
}
