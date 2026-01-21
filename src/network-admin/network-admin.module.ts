import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../common/prisma/prisma.module';
import { StripeModule } from '../stripe/stripe.module';
import { AuditLogModule } from '../modules/audit-log/audit-log.module';
import { EmailModule } from '../modules/email/email.module';
import { BookingModule } from '../modules/booking/booking.module';
import { CompanyDataModule } from '../company-data/company-data.module';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { AuthModule } from '../common/auth/auth.module';
import { NetworkAdminController } from './network-admin.controller';
import { NetworkAdminService } from './network-admin.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    StripeModule,
    AuditLogModule,
    EmailModule,
    BookingModule,
    CompanyDataModule,
    AuthModule,
    forwardRef(() => PlatformAdminModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
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
  controllers: [NetworkAdminController],
  providers: [NetworkAdminService],
  exports: [NetworkAdminService],
})
export class NetworkAdminModule {}
