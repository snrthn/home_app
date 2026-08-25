import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// PATCH /api/auth/profile 请求体：仅传需要更新的字段（全部可选）
export class UpdateProfileDto {
  @ApiProperty({ required: false, description: '昵称' }) @IsOptional() @IsString() nickname?: string;
  @ApiProperty({ required: false, description: '头像 URL' }) @IsOptional() @IsString() avatar?: string;
  @ApiProperty({ required: false, description: '真实姓名' }) @IsOptional() @IsString() realName?: string;
  @ApiProperty({ required: false, description: '性别', enum: ['male', 'female', 'unknown'] }) @IsOptional() @IsIn(['male', 'female', 'unknown']) gender?: string;
  @ApiProperty({ required: false, description: '生日（ISO 日期字符串）' }) @IsOptional() @IsString() birthday?: string;
  @ApiProperty({ required: false, description: '省份' }) @IsOptional() @IsString() province?: string;
  @ApiProperty({ required: false, description: '省份编码' }) @IsOptional() @IsString() provinceCode?: string;
  @ApiProperty({ required: false, description: '城市' }) @IsOptional() @IsString() city?: string;
  @ApiProperty({ required: false, description: '城市编码' }) @IsOptional() @IsString() cityCode?: string;
  @ApiProperty({ required: false, description: '区/县' }) @IsOptional() @IsString() district?: string;
  @ApiProperty({ required: false, description: '区/县编码' }) @IsOptional() @IsString() districtCode?: string;
  // 个人描述（自我介绍）：三端通用。允许传空串——服务端会写入 null 实现「清空」。
  @ApiProperty({ required: false, description: '个人简介（最多 500 字）' }) @IsOptional() @IsString() @MaxLength(500) bio?: string;
}
