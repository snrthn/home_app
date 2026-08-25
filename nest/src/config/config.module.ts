import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { ConfigPublicController } from './config.public.controller';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  providers: [ConfigService],
  controllers: [ConfigController, ConfigPublicController],
  exports: [ConfigService],
})
export class ConfigModule {}
