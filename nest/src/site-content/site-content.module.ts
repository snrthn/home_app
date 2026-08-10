import { Module } from '@nestjs/common';
import { SiteContentService } from './site-content.service';
import { SiteContentController } from './site-content.controller';
import { SiteContentPublicController } from './site-content.public.controller';

@Module({
  providers: [SiteContentService],
  controllers: [SiteContentController, SiteContentPublicController],
  exports: [SiteContentService],
})
export class SiteContentModule {}
