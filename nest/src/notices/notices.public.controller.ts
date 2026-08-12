import { Controller, Get, Query } from '@nestjs/common';
import { NoticesService } from './notices.service';

// 公开：取某端当前生效的公告列表（无需登录），供用户端/师傅端「平台公告」展示。
@Controller('notices')
export class NoticesPublicController {
  constructor(private s: NoticesService) {}

  // GET /notices?scope=customer&provinceCode=110000&cityCode=110100&districtCode=...
  // 返回已发布且在生效时间窗内的公告（含正文），并按当前用户地域做通知范围过滤
  @Get()
  async list(
    @Query('scope') scope: string,
    @Query('provinceCode') provinceCode?: string,
    @Query('cityCode') cityCode?: string,
    @Query('districtCode') districtCode?: string,
  ) {
    if (!scope) return [];
    const region = provinceCode
      ? { provinceCode, cityCode, districtCode }
      : undefined;
    return this.s.getPublicList(scope, region);
  }
}
