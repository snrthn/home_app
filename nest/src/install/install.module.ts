import { Module } from '@nestjs/common';
import { InstallController } from './install.controller';
import { InstallService } from './install.service';
import { InstallGuard } from './install.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InstallController],
  providers: [InstallService, InstallGuard],
  exports: [InstallService, InstallGuard],
})
export class InstallModule {}
