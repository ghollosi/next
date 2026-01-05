import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { SzamlazzProvider } from './szamlazz.provider';
import { ViesService } from './vies.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [BillingController],
  providers: [BillingService, SzamlazzProvider, ViesService],
  exports: [BillingService, ViesService],
})
export class BillingModule {}
