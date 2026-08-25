import { IsOptional, IsString, MinLength } from 'class-validator';
// POST /api/auth/password 请求体：设置或重置登录密码。
// - 首次设置（账号尚无 passwordHash）：oldPassword 可省略。
// - 重置（账号已有密码）：必须传 oldPassword 且需与当前密码一致。
export class SetPasswordDto {
  @IsOptional()
  @IsString()
  oldPassword?: string;
  @IsString()
  @MinLength(6)
  newPassword: string;
}
