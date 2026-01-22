import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { UserThrottlerGuard } from './common/throttler/user-throttle.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { SessionModule } from './common/session/session.module';
import { HealthModule } from './common/health/health.module';
import { NetworkModule } from './modules/network/network.module';
import { LocationModule } from './modules/location/location.module';
import { PartnerCompanyModule } from './modules/partner-company/partner-company.module';
import { DriverModule } from './modules/driver/driver.module';
import { VehicleModule } from './modules/vehicle/vehicle.module';
import { ServicePackageModule } from './modules/service-package/service-package.module';
import { WashEventModule } from './modules/wash-event/wash-event.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { EmailModule } from './modules/email/email.module';
import { SmsModule } from './modules/sms/sms.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ExchangeRateModule } from './modules/exchange-rate/exchange-rate.module';
import { PwaModule } from './pwa/pwa.module';
import { OperatorModule } from './operator/operator.module';
import { BillingModule } from './billing/billing.module';
import { PartnerPortalModule } from './partner-portal/partner-portal.module';
import { OperatorPortalModule } from './operator-portal/operator-portal.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { NetworkAdminModule } from './network-admin/network-admin.module';
import { StripeModule } from './stripe/stripe.module';
import { BookingModule } from './modules/booking/booking.module';
import { PlatformBillingModule } from './platform-billing/platform-billing.module';
import { CompanyDataModule } from './company-data/company-data.module';
import { AddressModule } from './modules/address/address.module';
import { SecurityModule } from './common/security/security.module';
import { TestPortalModule } from './test-portal/test-portal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    // SECURITY: Rate limiting - 300 requests per minute per IP
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute in milliseconds
      limit: 300, // max 300 requests per minute
    }]),
    PrismaModule,
    SecurityModule,
    SessionModule,
    HealthModule,
    NetworkModule,
    LocationModule,
    PartnerCompanyModule,
    DriverModule,
    VehicleModule,
    ServicePackageModule,
    WashEventModule,
    AuditLogModule,
    EmailModule,
    SmsModule,
    NotificationModule,
    ExchangeRateModule,
    PwaModule,
    OperatorModule,
    BillingModule,
    PartnerPortalModule,
    OperatorPortalModule,
    PlatformAdminModule,
    NetworkAdminModule,
    StripeModule,
    BookingModule,
    PlatformBillingModule,
    CompanyDataModule,
    AddressModule,
    TestPortalModule,
  ],
  providers: [
    // SECURITY: Apply user-aware rate limiting globally
    // Tracks both IP and user/session ID to prevent VPN rotation attacks
    {
      provide: APP_GUARD,
      useClass: UserThrottlerGuard,
    },
  ],
})
export class AppModule {}
