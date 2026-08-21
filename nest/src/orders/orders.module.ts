import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { DispatchSchedulerService } from './dispatch.scheduler';
import { SettlementsModule } from '../settlements/settlements.module';
import { PaymentsModule } from '../payments/payments.module';
import { GatewayModule } from '../gateway/gateway.module';
import { CommissionModule } from '../commission/commission.module';

@Module({
  // Payments 现反向依赖 Orders（退款走 transition），双向循环用 forwardRef 解开
  imports: [SettlementsModule, forwardRef(() => PaymentsModule), GatewayModule, CommissionModule],
  providers: [OrdersService, DispatchSchedulerService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
