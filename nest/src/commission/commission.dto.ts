import {
  IsIn,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertCommissionRuleDto {
  @ApiProperty({ description: '规则作用范围', enum: ['global', 'category', 'service'] })
  @IsIn(['global', 'category', 'service'], { message: 'scope 取值非法' })
  scope: 'global' | 'category' | 'service';

  /** global 时不传；category=类目 id，service=服务项 id */
  @ApiProperty({ required: false, description: '作用对象 ID（global 时不传）' })
  @IsOptional()
  @IsString()
  refId?: string;

  @ApiProperty({ description: '平台佣金率（0~1）' })
  @IsNumber({}, { message: '平台佣金率必须为数字' })
  @Min(0, { message: '平台佣金率不能小于 0' })
  @Max(1, { message: '平台佣金率不能大于 1' })
  platformRate: number;

  @ApiProperty({ description: '退款策略', enum: ['full', 'tiered', 'keep_commission'] })
  @IsIn(['full', 'tiered', 'keep_commission'], { message: '退款策略取值非法' })
  refundPolicy: 'full' | 'tiered' | 'keep_commission';

  /** 阶梯退款比例：{ departing: 0.8, arrived: 0.5 }，键须为订单状态 */
  @ApiProperty({ required: false, description: '阶梯退款比例配置' })
  @IsOptional()
  @IsObject({ message: '阶梯配置格式非法' })
  refundTiers?: Record<string, number>;

  @ApiProperty({ required: false, description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, description: '备注（最多 200 字）' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '备注不能超过 200 字' })
  note?: string;
}
