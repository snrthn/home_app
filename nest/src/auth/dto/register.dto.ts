import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// 用户（客户/师傅）自助注册入参。
// 管理员账号不通过此接口注册（由 init-admin 或后台创建）。
export class RegisterDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsString()
  phone: string;

  @ApiProperty({ description: '短信验证码' })
  @IsString()
  code: string;

  @ApiProperty({ description: '注册角色', enum: ['customer', 'master'] })
  @IsIn(['customer', 'master'])
  role: 'customer' | 'master';

  // 客户昵称（可选，缺省自动生成）
  @ApiProperty({ required: false, description: '客户昵称' })
  @IsOptional()
  @IsString()
  nickname?: string;

  // 师傅真实姓名（师傅注册必填）
  @ApiProperty({ required: false, description: '师傅真实姓名' })
  @IsOptional()
  @IsString()
  realName?: string;

  // 师傅所在城市（师傅注册必填）
  @ApiProperty({ required: false, description: '师傅所在城市' })
  @IsOptional()
  @IsString()
  city?: string;
}
