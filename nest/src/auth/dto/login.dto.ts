import { IsString, IsOptional, IsIn } from 'class-validator';
export class LoginDto {
  @IsString()
  phone: string;
  @IsOptional()
  @IsString()
  code?: string;
  @IsOptional()
  @IsString()
  password?: string;
  @IsOptional()
  @IsIn(['admin', 'customer', 'master'])
  role?: string;
  @IsOptional()
  @IsString()
  nickname?: string;

  // 登录方式：code=验证码登录，password=密码登录，admin=管理员密码登录
  // 缺省时按 role 推断（role=admin 视为 admin，否则 code）
  @IsOptional()
  @IsIn(['code', 'password', 'admin'])
  mode?: 'code' | 'password' | 'admin';
}
