import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @IsString() serviceItemId: string;
  @IsString() addressId: string;
  @IsOptional() @IsString() appointmentSlot?: string;
  @IsOptional() appointmentDate?: string; // ISO date
  @IsOptional() @IsString() remark?: string;
  @IsOptional() photos?: any;
}

export class AssignDto {
  @IsString() masterId: string; // Master.id
}

export class ArriveDto {
  @IsString() code: string; // 客户生成的到达验证码
}

export class CancelOrderDto {
  @IsString()
  @MinLength(1, { message: '请填写取消原因' })
  @MaxLength(200, { message: '取消原因不能超过 200 字' })
  reason: string;
}
