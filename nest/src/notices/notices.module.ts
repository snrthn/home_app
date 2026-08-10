import { Module } from '@nestjs/common';
import { NoticesService } from './notices.service';
import { NoticesController } from './notices.controller';
import { NoticesPublicController } from './notices.public.controller';

@Module({
  providers: [NoticesService],
  controllers: [NoticesController, NoticesPublicController],
  exports: [NoticesService],
})
export class NoticesModule {}
