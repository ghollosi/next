import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { NotificationService } from './notification.service';

@Module({
  imports: [ConfigModule, PrismaModule, EmailModule, SmsModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
