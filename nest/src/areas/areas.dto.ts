import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
// 服务区域（开通城市字典）节点的增删改 DTO。
// 区域采用 6 段式（province/provinceCode/city/cityCode/district/districtCode），
// 与 UserProfile / Master / ServiceItem 对齐；保留名称字段便于回显与按省/市筛选。
// 长度校验与 DB 列长度对齐：超限返回 400（避免 MySQL strict 下 Data too long 触发 500）。
// level / code / name / parentCode 由服务端根据 6 段式推导，前端无需计算。

export class CreateServiceAreaDto {
  // 至少选择一个省（直辖市也视为省一级）
  @IsString() @MaxLength(50, { message: '省份名称不能超过 50 个字符' })
  province: string;
  @IsString() @MaxLength(20, { message: '省份编码不能超过 20 个字符' })
  provinceCode: string;

  @IsOptional() @IsString() @MaxLength(50) city?: string;
  @IsOptional() @IsString() @MaxLength(20) cityCode?: string;
  @IsOptional() @IsString() @MaxLength(50) district?: string;
  @IsOptional() @IsString() @MaxLength(20) districtCode?: string;

  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
}

export class UpdateServiceAreaDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
}

// 级联启停：enabled=停/启用；cascadeChildren 仅启用时生效（停用永远整支向下传递）
export class SetAreaActiveDto {
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsBoolean() cascadeChildren?: boolean;
}
