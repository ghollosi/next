import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EmailModule } from '../modules/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
