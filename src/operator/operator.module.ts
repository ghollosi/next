import { Module } from '@nestjs/common';
import { OperatorController } from './operator.controller';
import { WashEventModule } from '../modules/wash-event/wash-event.module';
import { PartnerCompanyModule } from '../modules/partner-company/partner-company.module';
import { LocationModule } from '../modules/location/location.module';
import { ServicePackageModule } from '../modules/service-package/service-package.module';
import { DriverModule } from '../modules/driver/driver.module';

@Module({
  imports: [
    WashEventModule,
    PartnerCompanyModule,
    LocationModule,
    ServicePackageModule,
    DriverModule,
  ],
  controllers: [OperatorController],
})
export class OperatorModule {}
