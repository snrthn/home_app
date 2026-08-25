import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// POST /api/auth/reset-password 请求体：找回密码（无需登录态）。
// 以「手机号 + 验证码」完成身份核验后，直接设置新密码，绕过旧密码校验。
export class ResetPasswordDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsString()
  phone: string;

  @ApiProperty({ description: '短信验证码' })
  @IsString()
  code: string;

  @ApiProperty({ description: '新密码（至少 6 位）' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
