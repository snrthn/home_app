import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectSettlementDto {
  @ApiProperty({ description: '驳回原因' })
  @IsString()
  @MinLength(1, { message: '请填写驳回原因' })
  @MaxLength(200, { message: '驳回原因不能超过 200 字' })
  reason: string;
}

export class CreditSettlementDto {
  @ApiProperty({ required: false, description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '备注不能超过 200 字' })
  note?: string;
}
