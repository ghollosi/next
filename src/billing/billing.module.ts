import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { LocationBillingService } from './location-billing.service';
import { LocationBillingController } from './location-billing.controller';
import { LocationStatementScheduler } from './location-statement.scheduler';
import { SzamlazzProvider } from './szamlazz.provider';
import { BillingoProvider } from './billingo.provider';
import { NavOnlineProvider } from './nav-online.provider';
import { ViesService } from './vies.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [BillingController, LocationBillingController],
  providers: [
    BillingService,
    LocationBillingService,
    LocationStatementScheduler,
    SzamlazzProvider,
    BillingoProvider,
    NavOnlineProvider,
    ViesService,
  ],
  exports: [
    BillingService,
    LocationBillingService,
    LocationStatementScheduler,
    SzamlazzProvider,
    BillingoProvider,
    NavOnlineProvider,
    ViesService,
  ],
})
export class BillingModule {}
