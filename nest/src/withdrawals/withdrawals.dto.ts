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
import { ApiProperty } from '@nestjs/swagger';

export class CreateWithdrawalDto {
  @ApiProperty({ description: '提现金额' })
  @IsNumber()
  @Min(0.01, { message: '提现金额至少 0.01 元' })
  amount: number;

  @ApiProperty({ enum: ['wechat', 'alipay', 'bank'], description: '收款渠道' })
  @IsIn(['wechat', 'alipay', 'bank'], { message: '收款渠道不合法' })
  channel: 'wechat' | 'alipay' | 'bank';

  @ApiProperty({ description: '收款账号' })
  @IsString()
  @MinLength(1, { message: '请填写收款账号' })
  @MaxLength(100, { message: '收款账号不能超过 100 字' })
  account: string;
}

export class RejectWithdrawalDto {
  @ApiProperty({ description: '驳回原因' })
  @IsString()
  @MinLength(1, { message: '请填写驳回原因' })
  @MaxLength(200, { message: '驳回原因不能超过 200 字' })
  reason: string;
}
