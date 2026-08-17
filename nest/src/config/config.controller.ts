import {
  Controller,
  Patch,
  Body,
  UseGuards,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';
import { ConfigService } from './config.service';

// 仅管理员可写全局配置（GET 走公开控制器，无需登录）
export class UpdateSystemConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  siteName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerServicePhone?: string;
}

@Controller('admin/config')
export class ConfigController {
  constructor(private s: ConfigService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch('global')
  updateGlobal(@Body() dto: UpdateSystemConfigDto) {
    // primaryColor 若传入需为合法 hex，避免脏值污染前端主题推导
    if (dto.primaryColor && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(dto.primaryColor)) {
      throw new UnprocessableEntityException('primaryColor 必须为合法 hex 颜色');
    }
    return this.s.updateGlobal(dto);
  }
}
