import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { SettlementsModule } from '../settlements/settlements.module';
import { PaymentsModule } from '../payments/payments.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [SettlementsModule, PaymentsModule, GatewayModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
