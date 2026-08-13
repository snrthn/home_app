import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { ReviewsModule } from './reviews/reviews.module';
import { UploadModule } from './upload/upload.module';
import { AgreementsModule } from './agreements/agreements.module';
import { NoticesModule } from './notices/notices.module';
import { SiteContentModule } from './site-content/site-content.module';
import { GatewayModule } from './gateway/gateway.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
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
    ReviewsModule,
    UploadModule,
    AgreementsModule,
    NoticesModule,
    SiteContentModule,
    GatewayModule,
    AuditModule,
  ],
})
export class AppModule {}
