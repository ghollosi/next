import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
