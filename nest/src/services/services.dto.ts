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

// ===================== 服务类目 =====================
export class CreateCategoryDto {
  @IsString() @MaxLength(50, { message: '类目名称不能超过 50 个字符' })
  name: string;
  // 树形：parentId 为空表示一级类目（业务域）；最多三级（业务域→子类目→具体项）
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3) level?: number;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) icon?: string;
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MaxLength(50) name?: string;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) icon?: string;
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// 级联启停：enabled=停/启用；cascadeChildren 仅启用时生效（停用永远整支向下传递）
export class SetCategoryActiveDto {
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsBoolean() cascadeChildren?: boolean;
}

// ===================== 服务项目 =====================
// 服务项目为「服务模板」，地理无关：区域可用性由运行时（平台开通区域 ∩ 师傅接单范围 ∩ 订单地址）
// 动态判定，模板上不再存储省市区，也不再挂「工种类型」字段——业务域由所属一级类目表达。
// 字符串长度校验与 DB 列长度/类型对齐：超限返回 400（而非让 MySQL 报 Data too long 触发 500）。
export class CreateServiceItemDto {
  @IsString() categoryId: string;
  @IsString() @MaxLength(100, { message: '项目名称不能超过 100 个字符' })
  name: string;
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
  @IsOptional() @IsNumber() @Min(0) @Max(99999999.99) price?: number;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) coverImage?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) estimatedDuration?: number;
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
