import { Module } from '@nestjs/common';
import { OperatorPortalController } from './operator-portal.controller';
import { WashEventModule } from '../modules/wash-event/wash-event.module';
import { LocationModule } from '../modules/location/location.module';
import { BillingModule } from '../billing/billing.module';
import { AuditLogModule } from '../modules/audit-log/audit-log.module';
import { BookingModule } from '../modules/booking/booking.module';

@Module({
  imports: [WashEventModule, LocationModule, BillingModule, AuditLogModule, BookingModule],
  controllers: [OperatorPortalController],
})
export class OperatorPortalModule {}
