import { Controller, Get, Param } from '@nestjs/common';
import { SiteContentService } from './site-content.service';

// 公开：按 key 取站点内容（无需登录），供用户端/师傅端「关于我们」展示。
// 不存在返回 404，前端据此回退到内置静态兜底文案。
@Controller('site-content')
export class SiteContentPublicController {
  constructor(private s: SiteContentService) {}

  @Get(':key')
  get(@Param('key') key: string) {
    return this.s.getByKey(key);
  }
}
