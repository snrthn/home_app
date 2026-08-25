import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// POST /api/auth/password 请求体：设置或重置登录密码。
// - 首次设置（账号尚无 passwordHash）：oldPassword 可省略。
// - 重置（账号已有密码）：必须传 oldPassword 且需与当前密码一致。
export class SetPasswordDto {
  @ApiProperty({ required: false, description: '旧密码（重置时必填）' })
  @IsOptional()
  @IsString()
  oldPassword?: string;

  @ApiProperty({ description: '新密码（至少 6 位）' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
