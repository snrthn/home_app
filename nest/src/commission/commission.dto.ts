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

export class UpsertCommissionRuleDto {
  @IsIn(['global', 'category', 'service'], { message: 'scope 取值非法' })
  scope: 'global' | 'category' | 'service';

  /** global 时不传；category=类目 id，service=服务项 id */
  @IsOptional()
  @IsString()
  refId?: string;

  @IsNumber({}, { message: '平台佣金率必须为数字' })
  @Min(0, { message: '平台佣金率不能小于 0' })
  @Max(1, { message: '平台佣金率不能大于 1' })
  platformRate: number;

  @IsIn(['full', 'tiered', 'keep_commission'], { message: '退款策略取值非法' })
  refundPolicy: 'full' | 'tiered' | 'keep_commission';

  /** 阶梯退款比例：{ departing: 0.8, arrived: 0.5 }，键须为订单状态 */
  @IsOptional()
  @IsObject({ message: '阶梯配置格式非法' })
  refundTiers?: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '备注不能超过 200 字' })
  note?: string;
}
