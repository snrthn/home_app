import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMasterDto {
  @IsString() phone: string;
  @IsString() realName: string;
  @IsString() city: string;
  @IsOptional() @IsString() idCard?: string;
  @IsOptional() skills?: any;
  @IsOptional() @IsString() password?: string;
}

export class ApproveMasterDto {
  @IsString() status: 'active' | 'disabled';
  @IsOptional() @IsString() reason?: string;
}

// 接单范围单项：基于 ServiceArea 已开通节点，支持省/市/区部分粒度（缺级通配）
export class MasterServiceAreaItemDto {
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() provinceCode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() cityCode?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() districtCode?: string;
}

// PATCH /api/masters/me 请求体：师傅完善自身专属资料（全部可选）
export class UpdateMasterMeDto {
  @IsOptional() @IsString() realName?: string;
  @IsOptional() @IsString() idCard?: string;
  @IsOptional() skills?: any; // 技能标签数组
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() provinceCode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() cityCode?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() districtCode?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MasterServiceAreaItemDto) serviceAreas?: MasterServiceAreaItemDto[];
}
