import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { SlaSchedulerService } from './sla.scheduler';
import { GatewayModule } from '../gateway/gateway.module';
import { PaymentsModule } from '../payments/payments.module';
import { SettlementsModule } from '../settlements/settlements.module';

@Module({
  imports: [GatewayModule, PaymentsModule, SettlementsModule],
  providers: [TicketsService, SlaSchedulerService],
  controllers: [TicketsController],
  exports: [TicketsService],
})
export class TicketsModule {}
