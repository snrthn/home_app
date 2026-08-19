import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { GatewayModule } from '../gateway/gateway.module';
import { SettlementsModule } from '../settlements/settlements.module';
import { CommissionModule } from '../commission/commission.module';

@Module({
  imports: [GatewayModule, SettlementsModule, CommissionModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
