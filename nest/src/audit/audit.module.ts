import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from '../common/audit.interceptor';

@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    // 全局审计拦截器：仅对打了 @Audit 的接口自动落库
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
