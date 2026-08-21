import { IsString, MinLength } from 'class-validator';

// POST /api/auth/reset-password 请求体：找回密码（无需登录态）。
// 以「手机号 + 验证码」完成身份核验后，直接设置新密码，绕过旧密码校验。
export class ResetPasswordDto {
  @IsString()
  phone: string;

  @IsString()
  code: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
