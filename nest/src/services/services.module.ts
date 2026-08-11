import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesAdminController, ServicesPublicController } from './services.controller';

@Module({
  providers: [ServicesService],
  controllers: [ServicesAdminController, ServicesPublicController],
  exports: [ServicesService],
})
export class ServicesModule {}
