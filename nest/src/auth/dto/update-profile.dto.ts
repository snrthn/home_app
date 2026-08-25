import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';
// PATCH /api/auth/profile 请求体：仅传需要更新的字段（全部可选）
export class UpdateProfileDto {
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() avatar?: string;
  @IsOptional() @IsString() realName?: string;
  @IsOptional() @IsIn(['male', 'female', 'unknown']) gender?: string;
  @IsOptional() @IsString() birthday?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() provinceCode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() cityCode?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() districtCode?: string;
  // 个人描述（自我介绍）：三端通用。允许传空串——服务端会写入 null 实现「清空」。
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
}
