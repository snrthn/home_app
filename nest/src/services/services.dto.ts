import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';

export class CreateServiceItemDto {
  @IsString() categoryId: string;
  @IsString() name: string;
  @IsIn(['clean', 'repair']) type: string;
  @IsString() city: string;
  @IsNumber() price: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() sort?: number;
}
