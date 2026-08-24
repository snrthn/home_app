import { IsString, IsOptional, IsBoolean, IsIn, IsArray } from 'class-validator';

export class CreateTicketDto {
  @IsOptional()
  @IsIn(['consult', 'complaint'])
  type?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsString()
  reviewId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  masterId?: string;

  @IsOptional()
  @IsString()
  againstMasterId?: string;

  @IsOptional()
  @IsString()
  expectation?: string;
}

export class AddCommentDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @IsOptional()
  @IsIn(['all', 'master', 'customer'])
  visibleTo?: string;
}

export class AppealDto {
  @IsString()
  content: string;
}

export class ResolveComplaintDto {
  @IsIn(['refund', 'compensate', 'redispatch', 'no_fault'])
  result: string;
}
