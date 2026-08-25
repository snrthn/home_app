import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// 服务区域（开通城市字典）节点的增删改 DTO。
// 区域采用 6 段式（province/provinceCode/city/cityCode/district/districtCode），
// 与 UserProfile / Master / ServiceItem 对齐；保留名称字段便于回显与按省/市筛选。
// 长度校验与 DB 列长度对齐：超限返回 400（避免 MySQL strict 下 Data too long 触发 500）。
// level / code / name / parentCode 由服务端根据 6 段式推导，前端无需计算。

export class CreateServiceAreaDto {
  // 至少选择一个省（直辖市也视为省一级）
  @ApiProperty({ description: '省份名称' }) @IsString() @MaxLength(50, { message: '省份名称不能超过 50 个字符' })
  province: string;
  @ApiProperty({ description: '省份编码' }) @IsString() @MaxLength(20, { message: '省份编码不能超过 20 个字符' })
  provinceCode: string;

  @ApiProperty({ required: false, description: '城市名称' }) @IsOptional() @IsString() @MaxLength(50) city?: string;
  @ApiProperty({ required: false, description: '城市编码' }) @IsOptional() @IsString() @MaxLength(20) cityCode?: string;
  @ApiProperty({ required: false, description: '区/县名称' }) @IsOptional() @IsString() @MaxLength(50) district?: string;
  @ApiProperty({ required: false, description: '区/县编码' }) @IsOptional() @IsString() @MaxLength(20) districtCode?: string;

  @ApiProperty({ required: false, description: '是否启用' }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiProperty({ required: false, description: '排序号' }) @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
}

export class UpdateServiceAreaDto {
  @ApiProperty({ required: false, description: '是否启用' }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiProperty({ required: false, description: '排序号' }) @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
}

// 级联启停：enabled=停/启用；cascadeChildren 仅启用时生效（停用永远整支向下传递）
export class SetAreaActiveDto {
  @ApiProperty({ description: '启用/停用' }) @IsBoolean() enabled: boolean;
  @ApiProperty({ required: false, description: '是否级联子节点' }) @IsOptional() @IsBoolean() cascadeChildren?: boolean;
}
