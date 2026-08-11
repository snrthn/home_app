import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsBoolean,
  Min,
  IsInt,
  MaxLength,
  Max,
} from 'class-validator';

// 服务类型枚举（与 schema ServiceType 对齐）。下单时决定走哪条 SOP 分支（清洗/维修/保洁/疏通）。
export const SERVICE_TYPES = ['clean', 'repair', 'cleaning', 'dredging'];
export type ServiceTypeValue = 'clean' | 'repair' | 'cleaning' | 'dredging';

// ===================== 服务类目 =====================
export class CreateCategoryDto {
  @IsString() @MaxLength(50, { message: '类目名称不能超过 50 个字符' })
  name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) icon?: string;
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MaxLength(50) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) icon?: string;
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ===================== 服务项目 =====================
// 服务区域采用 6 段式（province/provinceCode/city/cityCode/district/districtCode），
// 与 UserProfile / Master 对齐；保留 city 名称字段以兼容 Order.city 的复制逻辑。
// 字符串长度校验与 DB 列长度/类型对齐：超限返回 400（而非让 MySQL 报 Data too long 触发 500）。
export class CreateServiceItemDto {
  @IsString() categoryId: string;
  @IsString() @MaxLength(100, { message: '项目名称不能超过 100 个字符' })
  name: string;
  @IsIn(SERVICE_TYPES) type: ServiceTypeValue;
  @IsOptional() @IsString() @MaxLength(50) province?: string;
  @IsOptional() @IsString() @MaxLength(20) provinceCode?: string;
  @IsOptional() @IsString() @MaxLength(50) city?: string;
  @IsOptional() @IsString() @MaxLength(20) cityCode?: string;
  @IsOptional() @IsString() @MaxLength(50) district?: string;
  @IsOptional() @IsString() @MaxLength(20) districtCode?: string;
  @IsNumber() @Min(0) @Max(99999999.99, { message: '价格超出允许范围（最高 99999999.99）' })
  price: number;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) coverImage?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) estimatedDuration?: number;
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateServiceItemDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsIn(SERVICE_TYPES) type?: ServiceTypeValue;
  @IsOptional() @IsString() @MaxLength(50) province?: string;
  @IsOptional() @IsString() @MaxLength(20) provinceCode?: string;
  @IsOptional() @IsString() @MaxLength(50) city?: string;
  @IsOptional() @IsString() @MaxLength(20) cityCode?: string;
  @IsOptional() @IsString() @MaxLength(50) district?: string;
  @IsOptional() @IsString() @MaxLength(20) districtCode?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(99999999.99) price?: number;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) coverImage?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) estimatedDuration?: number;
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
