import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrdersGateway } from './orders.gateway';

@Module({
  imports: [
    // 网关握手鉴权复用同一套 JWT_ACCESS_SECRET（与 AuthModule 同源）。
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [OrdersGateway],
  exports: [OrdersGateway],
})
export class GatewayModule {}
