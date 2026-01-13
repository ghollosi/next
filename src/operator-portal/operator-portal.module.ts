import { Module } from '@nestjs/common';
import { OperatorPortalController } from './operator-portal.controller';
import { WashEventModule } from '../modules/wash-event/wash-event.module';
import { LocationModule } from '../modules/location/location.module';
import { BillingModule } from '../billing/billing.module';
import { AuditLogModule } from '../modules/audit-log/audit-log.module';

@Module({
  imports: [WashEventModule, LocationModule, BillingModule, AuditLogModule],
  controllers: [OperatorPortalController],
})
export class OperatorPortalModule {}
