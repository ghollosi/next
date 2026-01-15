import { Module } from '@nestjs/common';
import { CompanyDataService } from './company-data.service';
import { OptenProvider } from './opten.provider';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    CompanyDataService,
    OptenProvider,
  ],
  exports: [CompanyDataService, OptenProvider],
})
export class CompanyDataModule {}
