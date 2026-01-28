import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UnifiedLoginController } from './unified-login.controller';
import { UnifiedLoginService } from './unified-login.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AuditLogModule } from '../modules/audit-log/audit-log.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditLogModule,
  ],
  controllers: [UnifiedLoginController],
  providers: [UnifiedLoginService],
  exports: [UnifiedLoginService],
})
export class AuthModule {}
