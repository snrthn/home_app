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
import { ApiProperty } from '@nestjs/swagger';

// ===================== 服务类目 =====================
export class CreateCategoryDto {
  @ApiProperty({ description: '类目名称' })
  @IsString() @MaxLength(50, { message: '类目名称不能超过 50 个字符' })
  name: string;
  // 树形：parentId 为空表示一级类目（业务域）；最多三级（业务域→子类目→具体项）
  @ApiProperty({ required: false, description: '父类目ID，为空表示一级类目' })
  @IsOptional() @IsString() parentId?: string;
  @ApiProperty({ required: false, description: '层级（1-3）' })
  @IsOptional() @IsInt() @Min(1) @Max(3) level?: number;
  @ApiProperty({ required: false, description: '描述' })
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiProperty({ required: false, description: '图标' })
  @IsOptional() @IsString() @MaxLength(200) icon?: string;
  @ApiProperty({ required: false, description: '排序' })
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
  @ApiProperty({ required: false, description: '是否启用' })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiProperty({ required: false, description: '类目名称' })
  @IsOptional() @IsString() @MaxLength(50) name?: string;
  @ApiProperty({ required: false, description: '父类目ID' })
  @IsOptional() @IsString() parentId?: string | null;
  @ApiProperty({ required: false, description: '描述' })
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiProperty({ required: false, description: '图标' })
  @IsOptional() @IsString() @MaxLength(200) icon?: string;
  @ApiProperty({ required: false, description: '排序' })
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
  @ApiProperty({ required: false, description: '是否启用' })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// 级联启停：enabled=停/启用；cascadeChildren 仅启用时生效（停用永远整支向下传递）
export class SetCategoryActiveDto {
  @ApiProperty({ description: '启用/停用' })
  @IsBoolean() enabled: boolean;
  @ApiProperty({ required: false, description: '是否级联子类目（仅启用时生效）' })
  @IsOptional() @IsBoolean() cascadeChildren?: boolean;
}

// ===================== 服务项目 =====================
// 服务项目为「服务模板」，地理无关：区域可用性由运行时（平台开通区域 ∩ 师傅接单范围 ∩ 订单地址）
// 动态判定，模板上不再存储省市区，也不再挂「工种类型」字段——业务域由所属一级类目表达。
// 字符串长度校验与 DB 列长度/类型对齐：超限返回 400（而非让 MySQL 报 Data too long 触发 500）。
export class CreateServiceItemDto {
  @ApiProperty({ description: '所属类目ID' })
  @IsString() categoryId: string;
  @ApiProperty({ description: '项目名称' })
  @IsString() @MaxLength(100, { message: '项目名称不能超过 100 个字符' })
  name: string;
  @ApiProperty({ description: '价格' })
  @IsNumber() @Min(0) @Max(99999999.99, { message: '价格超出允许范围（最高 99999999.99）' })
  price: number;
  @ApiProperty({ required: false, description: '计价单位' })
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @ApiProperty({ required: false, description: '描述' })
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiProperty({ required: false, description: '封面图' })
  @IsOptional() @IsString() @MaxLength(2000) coverImage?: string;
  @ApiProperty({ required: false, description: '预估耗时（分钟）' })
  @IsOptional() @IsInt() @Min(0) @Max(100000) estimatedDuration?: number;
  @ApiProperty({ required: false, description: '排序' })
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
  @ApiProperty({ required: false, description: '是否启用' })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateServiceItemDto {
  @ApiProperty({ required: false, description: '项目名称' })
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiProperty({ required: false, description: '价格' })
  @IsOptional() @IsNumber() @Min(0) @Max(99999999.99) price?: number;
  @ApiProperty({ required: false, description: '计价单位' })
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @ApiProperty({ required: false, description: '描述' })
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiProperty({ required: false, description: '封面图' })
  @IsOptional() @IsString() @MaxLength(2000) coverImage?: string;
  @ApiProperty({ required: false, description: '预估耗时（分钟）' })
  @IsOptional() @IsInt() @Min(0) @Max(100000) estimatedDuration?: number;
  @ApiProperty({ required: false, description: '排序' })
  @IsOptional() @IsInt() @Min(0) @Max(99999) sort?: number;
  @ApiProperty({ required: false, description: '是否启用' })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
