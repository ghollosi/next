import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './common/health/health.module';
import { NetworkModule } from './modules/network/network.module';
import { LocationModule } from './modules/location/location.module';
import { PartnerCompanyModule } from './modules/partner-company/partner-company.module';
import { DriverModule } from './modules/driver/driver.module';
import { VehicleModule } from './modules/vehicle/vehicle.module';
import { ServicePackageModule } from './modules/service-package/service-package.module';
import { WashEventModule } from './modules/wash-event/wash-event.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { PwaModule } from './pwa/pwa.module';
import { OperatorModule } from './operator/operator.module';
import { BillingModule } from './billing/billing.module';
import { PartnerPortalModule } from './partner-portal/partner-portal.module';
import { OperatorPortalModule } from './operator-portal/operator-portal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    HealthModule,
    NetworkModule,
    LocationModule,
    PartnerCompanyModule,
    DriverModule,
    VehicleModule,
    ServicePackageModule,
    WashEventModule,
    AuditLogModule,
    PwaModule,
    OperatorModule,
    BillingModule,
    PartnerPortalModule,
    OperatorPortalModule,
  ],
})
export class AppModule {}
