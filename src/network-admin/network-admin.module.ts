import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../common/prisma/prisma.module';
import { StripeModule } from '../stripe/stripe.module';
import { NetworkAdminController } from './network-admin.controller';
import { NetworkAdminService } from './network-admin.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    StripeModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'vsys-network-secret',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NetworkAdminController],
  providers: [NetworkAdminService],
  exports: [NetworkAdminService],
})
export class NetworkAdminModule {}
