import { Module } from '@nestjs/common';
import { AgreementsService } from './agreements.service';
import { AgreementsController } from './agreements.controller';
import { AgreementsPublicController } from './agreements.public.controller';

@Module({
  providers: [AgreementsService],
  controllers: [AgreementsController, AgreementsPublicController],
  exports: [AgreementsService],
})
export class AgreementsModule {}
