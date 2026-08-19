import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { GatewayModule } from '../gateway/gateway.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  // 评价走订单状态机，需注入 OrdersService（单向依赖，无循环）
  imports: [GatewayModule, OrdersModule],
  providers: [ReviewsService],
  controllers: [ReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}
