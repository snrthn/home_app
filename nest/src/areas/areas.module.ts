import { Module } from '@nestjs/common';
import { AreasService } from './areas.service';
import { AreasAdminController } from './areas.controller';

@Module({
  providers: [AreasService],
  controllers: [AreasAdminController],
  exports: [AreasService],
})
export class AreasModule {}
