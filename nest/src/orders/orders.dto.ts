import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty()
  @IsString() serviceItemId: string;
  @ApiProperty()
  @IsString() addressId: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() appointmentSlot?: string;
  @ApiProperty({ required: false })
  @IsOptional() appointmentDate?: string; // ISO date
  @ApiProperty({ required: false })
  @IsOptional() @IsString() remark?: string;
  @ApiProperty({ required: false, type: () => String, isArray: true })
  @IsOptional() photos?: string[];
}

export class AssignDto {
  @ApiProperty()
  @IsString() masterId: string; // Master.id
}

export class ArriveDto {
  @ApiProperty()
  @IsString() code: string; // 客户生成的到达验证码
}

export class CancelOrderDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: '请填写取消原因' })
  @MaxLength(200, { message: '取消原因不能超过 200 字' })
  reason: string;
}
