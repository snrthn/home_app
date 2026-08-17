import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { ConfigPublicController } from './config.public.controller';

@Module({
  providers: [ConfigService],
  controllers: [ConfigController, ConfigPublicController],
  exports: [ConfigService],
})
export class ConfigModule {}
