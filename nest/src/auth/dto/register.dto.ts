import { IsString, IsOptional, IsIn } from 'class-validator';
// 用户（客户/师傅）自助注册入参。
// 管理员账号不通过此接口注册（由 init-admin 或后台创建）。
export class RegisterDto {
  @IsString()
  phone: string;
  @IsString()
  code: string;
  @IsIn(['customer', 'master'])
  role: 'customer' | 'master';

  // 客户昵称（可选，缺省自动生成）
  @IsOptional()
  @IsString()
  nickname?: string;

  // 师傅真实姓名（师傅注册必填）
  @IsOptional()
  @IsString()
  realName?: string;

  // 师傅所在城市（师傅注册必填）
  @IsOptional()
  @IsString()
  city?: string;
}
