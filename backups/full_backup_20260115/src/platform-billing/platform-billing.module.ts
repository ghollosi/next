import { Module, forwardRef } from '@nestjs/common';
import { PlatformBillingController } from './platform-billing.controller';
import { PlatformBillingService } from './platform-billing.service';
import { BillingModule } from '../billing/billing.module';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';

/**
 * Platform Billing Module
 *
 * Handles Platform → Network invoicing and billing management.
 * Uses the existing billing providers (Számlázz.hu, Billingo) for invoice generation.
 */
@Module({
  imports: [
    BillingModule,
    forwardRef(() => PlatformAdminModule), // Use forwardRef to avoid circular dependency
  ],
  controllers: [PlatformBillingController],
  providers: [PlatformBillingService],
  exports: [PlatformBillingService],
})
export class PlatformBillingModule {}
