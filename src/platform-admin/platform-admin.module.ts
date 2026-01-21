import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AuditLogModule } from '../modules/audit-log/audit-log.module';
import { EmailModule } from '../modules/email/email.module';
import { CompanyDataModule } from '../company-data/company-data.module';
import { AuthModule } from '../common/auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    AuditLogModule,
    EmailModule,
    CompanyDataModule,
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get('JWT_SECRET');
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET environment variable is required in production');
        }
        return {
          secret: secret || 'dev-only-secret-do-not-use-in-production',
          // SECURITY: Access tokens now have 15min expiry with refresh token support
          signOptions: { expiresIn: '15m' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
  exports: [PlatformAdminService],
})
export class PlatformAdminModule {}
