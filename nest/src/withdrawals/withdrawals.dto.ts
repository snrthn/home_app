import {
  IsString,
  IsNumber,
  IsEnum,
  IsIn,
  MinLength,
  MaxLength,
  Min,
  IsOptional,
} from 'class-validator';

export class CreateWithdrawalDto {
  @IsNumber()
  @Min(0.01, { message: '提现金额至少 0.01 元' })
  amount: number;

  @IsIn(['wechat', 'alipay', 'bank'], { message: '收款渠道不合法' })
  channel: 'wechat' | 'alipay' | 'bank';

  @IsString()
  @MinLength(1, { message: '请填写收款账号' })
  @MaxLength(100, { message: '收款账号不能超过 100 字' })
  account: string;
}

export class RejectWithdrawalDto {
  @IsString()
  @MinLength(1, { message: '请填写驳回原因' })
  @MaxLength(200, { message: '驳回原因不能超过 200 字' })
  reason: string;
}
