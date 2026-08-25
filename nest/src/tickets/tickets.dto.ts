import { IsString, IsOptional, IsBoolean, IsIn, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({ required: false, enum: ['consult', 'complaint'], description: '工单类型' })
  @IsOptional()
  @IsIn(['consult', 'complaint'])
  type?: string;

  @ApiProperty({ required: false, description: '关联订单ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({ required: false, enum: ['low', 'normal', 'high', 'urgent'], description: '优先级' })
  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string;

  @ApiProperty({ required: false, description: '原因' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false, description: '来源' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ description: '标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '内容' })
  @IsString()
  content: string;

  @ApiProperty({ required: false, type: [String], description: '图片列表' })
  @IsOptional()
  @IsArray()
  images?: string[];

  @ApiProperty({ required: false, description: '关联评价ID' })
  @IsOptional()
  @IsString()
  reviewId?: string;

  @ApiProperty({ required: false, description: '客户ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ required: false, description: '师傅ID' })
  @IsOptional()
  @IsString()
  masterId?: string;

  @ApiProperty({ required: false, description: '被投诉师傅ID' })
  @IsOptional()
  @IsString()
  againstMasterId?: string;

  @ApiProperty({ required: false, description: '期望处理方式' })
  @IsOptional()
  @IsString()
  expectation?: string;
}

export class AddCommentDto {
  @ApiProperty({ description: '评论内容' })
  @IsString()
  content: string;

  @ApiProperty({ required: false, description: '是否内部备注' })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @ApiProperty({ required: false, enum: ['all', 'master', 'customer'], description: '可见范围' })
  @IsOptional()
  @IsIn(['all', 'master', 'customer'])
  visibleTo?: string;
}

export class AppealDto {
  @ApiProperty({ description: '申诉内容' })
  @IsString()
  content: string;
}

export class ResolveComplaintDto {
  @ApiProperty({ enum: ['refund', 'compensate', 'redispatch', 'no_fault'], description: '处置结果' })
  @IsIn(['refund', 'compensate', 'redispatch', 'no_fault'])
  result: string;
}
