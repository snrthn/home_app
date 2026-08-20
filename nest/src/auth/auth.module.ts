import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    PassportModule,
    // heartbeat 需要注入 OrdersGateway 通知工作台刷新
    GatewayModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        // 必须传数字：jsonwebtoken 把数字当“秒”；若传无单位字符串"3600"会被 ms 库当成毫秒(3.6s)
        signOptions: {
          expiresIn: Number(config.get('JWT_ACCESS_TTL') || 3600),
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
