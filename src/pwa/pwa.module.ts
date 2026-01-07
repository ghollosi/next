import { Module } from '@nestjs/common';
import { PwaController } from './pwa.controller';
import { DriverModule } from '../modules/driver/driver.module';
import { WashEventModule } from '../modules/wash-event/wash-event.module';
import { VehicleModule } from '../modules/vehicle/vehicle.module';
import { ServicePackageModule } from '../modules/service-package/service-package.module';
import { LocationModule } from '../modules/location/location.module';
import { PartnerCompanyModule } from '../modules/partner-company/partner-company.module';
import { NotificationModule } from '../modules/notification/notification.module';
import { NetworkModule } from '../modules/network/network.module';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    DriverModule,
    WashEventModule,
    VehicleModule,
    ServicePackageModule,
    LocationModule,
    PartnerCompanyModule,
    NotificationModule,
    NetworkModule,
  ],
  controllers: [PwaController],
})
export class PwaModule {}
