import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { GatewayModule } from '../gateway/gateway.module';
import { SettlementsModule } from '../settlements/settlements.module';
import { CommissionModule } from '../commission/commission.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  // 退款走订单状态机(transition)，反向依赖 Orders；与 OrdersModule 双向循环用 forwardRef 解开
  imports: [GatewayModule, SettlementsModule, CommissionModule, forwardRef(() => OrdersModule)],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
