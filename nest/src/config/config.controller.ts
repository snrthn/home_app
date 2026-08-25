import {
  Controller,
  Patch,
  Body,
  UseGuards,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@laoma/shared';
import { ConfigService } from './config.service';

// 仅管理员可写全局配置（GET 走公开控制器，无需登录）
export class UpdateSystemConfigDto {
  @ApiProperty({ required: false, description: '站点名称' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  siteName?: string;

  @ApiProperty({ required: false, description: 'Logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ required: false, description: '主题色（hex）' })
  @IsOptional()
  @IsString()
  @MaxLength(9)
  primaryColor?: string;

  @ApiProperty({ required: false, description: '客服电话' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerServicePhone?: string;

  // 短信验证码模式：mock=开发/演示（验证码随响应回传前端）；real=真实阿里云短信下发
  @ApiProperty({ required: false, description: '短信验证码模式', enum: ['mock', 'real'] })
  @IsOptional()
  @IsIn(['mock', 'real'])
  smsMode?: 'mock' | 'real';

  // 阿里云短信网关参数（仅 real 模式生效）
  @ApiProperty({ required: false, description: '阿里云 AccessKeyId' })
  @IsOptional()
  @IsString()
  smsAccessKeyId?: string;

  @ApiProperty({ required: false, description: '阿里云 AccessKeySecret' })
  @IsOptional()
  @IsString()
  smsAccessKeySecret?: string;

  @ApiProperty({ required: false, description: '短信签名' })
  @IsOptional()
  @IsString()
  smsSignName?: string;

  @ApiProperty({ required: false, description: '短信模板 Code' })
  @IsOptional()
  @IsString()
  smsTemplateCode?: string;
}

@ApiTags('系统配置')
@Controller('admin/config')
export class ConfigController {
  constructor(private s: ConfigService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新全局配置' })
  @ApiBody({ type: UpdateSystemConfigDto })
  @Patch('global')
  updateGlobal(@Body() dto: UpdateSystemConfigDto) {
    // primaryColor 若传入需为合法 hex，避免脏值污染前端主题推导
    if (dto.primaryColor && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(dto.primaryColor)) {
      throw new UnprocessableEntityException('primaryColor 必须为合法 hex 颜色');
    }
    return this.s.updateGlobal(dto);
  }
}
