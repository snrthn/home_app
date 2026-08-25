import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMasterDto {
  @ApiProperty()
  @IsString() phone: string;
  @ApiProperty()
  @IsString() realName: string;
  @ApiProperty()
  @IsString() city: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() idCard?: string;
  @ApiProperty({ required: false })
  @IsOptional() skills?: any;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() password?: string;
}

export class ApproveMasterDto {
  @ApiProperty()
  @IsString() status: 'active' | 'disabled';
  @ApiProperty({ required: false })
  @IsOptional() @IsString() reason?: string;
}

// 接单范围单项：基于 ServiceArea 已开通节点，支持省/市/区部分粒度（缺级通配）
export class MasterServiceAreaItemDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsString() province?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() provinceCode?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() city?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() cityCode?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() district?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() districtCode?: string;
}

// PATCH /api/masters/me 请求体：师傅完善自身专属资料（全部可选）
export class UpdateMasterMeDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsString() realName?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() idCard?: string;
  @ApiProperty({ required: false })
  @IsOptional() skills?: any; // 技能标签数组
  @ApiProperty({ required: false })
  @IsOptional() @IsString() province?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() provinceCode?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() city?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() cityCode?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() district?: string;
  @ApiProperty({ required: false })
  @IsOptional() @IsString() districtCode?: string;
  @ApiProperty({ required: false, type: () => MasterServiceAreaItemDto, isArray: true })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MasterServiceAreaItemDto) serviceAreas?: MasterServiceAreaItemDto[];
}
