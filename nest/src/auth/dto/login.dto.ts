import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsString()
  phone: string;

  @ApiProperty({ required: false, description: '短信验证码' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ required: false, description: '登录密码' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ required: false, description: '角色', enum: ['admin', 'customer', 'master'] })
  @IsOptional()
  @IsIn(['admin', 'customer', 'master'])
  role?: string;

  @ApiProperty({ required: false, description: '昵称' })
  @IsOptional()
  @IsString()
  nickname?: string;

  // 登录方式：code=验证码登录，password=密码登录，admin=管理员密码登录
  // 缺省时按 role 推断（role=admin 视为 admin，否则 code）
  @ApiProperty({ required: false, description: '登录方式', enum: ['code', 'password', 'admin'] })
  @IsOptional()
  @IsIn(['code', 'password', 'admin'])
  mode?: 'code' | 'password' | 'admin';
}
