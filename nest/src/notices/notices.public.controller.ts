import { Controller, Get, Query } from '@nestjs/common';
import { NoticesService, type RegionFilter } from './notices.service';

// 公开：取某端当前生效的公告列表（无需登录），供用户端/师傅端「平台公告」展示。
@Controller('notices')
export class NoticesPublicController {
  constructor(private s: NoticesService) {}

  // GET /notices?scope=master&regions=<JSON数组>
  // 数组元素为 { provinceCode, cityCode?, districtCode? }，命中任一即可见。
  // 兼容旧调用：未传 regions 但传了 provinceCode 时，按单 region 处理。
  @Get()
  async list(
    @Query('scope') scope: string,
    @Query('regions') regionsRaw?: string,
    @Query('provinceCode') provinceCode?: string,
    @Query('cityCode') cityCode?: string,
    @Query('districtCode') districtCode?: string,
  ) {
    if (!scope) return [];
    let regions: RegionFilter[] | undefined;
    if (regionsRaw) {
      try {
        const parsed = JSON.parse(regionsRaw);
        if (Array.isArray(parsed)) {
          regions = parsed.filter(
            (r: any) => r && typeof r.provinceCode === 'string',
          ) as RegionFilter[];
        }
      } catch {
        regions = undefined;
      }
    }
    if (!regions || regions.length === 0) {
      if (provinceCode) regions = [{ provinceCode, cityCode, districtCode }];
    }
    return this.s.getPublicList(
      scope,
      regions && regions.length ? regions : undefined,
    );
  }
}
