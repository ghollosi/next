import { Module } from '@nestjs/common';
import { TestPortalController } from './test-portal.controller';
import { TestPortalService } from './test-portal.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EmailModule } from '../modules/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [TestPortalController],
  providers: [TestPortalService],
  exports: [TestPortalService],
})
export class TestPortalModule {}
