import { Module } from '@nestjs/common';
import { PartnerPortalController } from './partner-portal.controller';
import { PartnerCompanyModule } from '../modules/partner-company/partner-company.module';
import { WashEventModule } from '../modules/wash-event/wash-event.module';
import { AuditLogModule } from '../modules/audit-log/audit-log.module';

@Module({
  imports: [PartnerCompanyModule, WashEventModule, AuditLogModule],
  controllers: [PartnerPortalController],
})
export class PartnerPortalModule {}
