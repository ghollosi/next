import { Module } from '@nestjs/common';
import { CompanyDataService } from './company-data.service';
import { OptenProvider } from './opten.provider';
import { BisnodeProvider } from './bisnode.provider';
import { ECegjegyzekProvider } from './ecegjegyzek.provider';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    CompanyDataService,
    OptenProvider,
    BisnodeProvider,
    ECegjegyzekProvider,
  ],
  exports: [CompanyDataService, OptenProvider, BisnodeProvider, ECegjegyzekProvider],
})
export class CompanyDataModule {}
