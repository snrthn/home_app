import { IsString, IsOptional } from 'class-validator';

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
