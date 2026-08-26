import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RbacModule } from './rbac/rbac.module';
import { MastersModule } from './masters/masters.module';
import { ServicesModule } from './services/services.module';
import { AreasModule } from './areas/areas.module';
import { AddressesModule } from './addresses/addresses.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { SettlementsModule } from './settlements/settlements.module';
import { CommissionModule } from './commission/commission.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UploadModule } from './upload/upload.module';
import { AgreementsModule } from './agreements/agreements.module';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { NoticesModule } from './notices/notices.module';
import { SiteContentModule } from './site-content/site-content.module';
import { GatewayModule } from './gateway/gateway.module';
import { AuditModule } from './audit/audit.module';
import { ReportsModule } from './reports/reports.module';
import { TicketsModule } from './tickets/tickets.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RbacModule,
    MastersModule,
    ServicesModule,
    AreasModule,
    AddressesModule,
    OrdersModule,
    PaymentsModule,
    SettlementsModule,
    CommissionModule,
    WithdrawalsModule,
    ReviewsModule,
    UploadModule,
    AgreementsModule,
    AppConfigModule,
    NoticesModule,
    SiteContentModule,
    GatewayModule,
    AuditModule,
  ReportsModule,
  TicketsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
