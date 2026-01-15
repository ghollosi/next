import { Module } from '@nestjs/common';
import { PartnerCompanyService } from './partner-company.service';

@Module({
  providers: [PartnerCompanyService],
  exports: [PartnerCompanyService],
})
export class PartnerCompanyModule {}
