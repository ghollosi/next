import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }

    // Delete in order respecting foreign key constraints
    const models = [
      'auditLog',
      'washEvent',
      'locationServiceAvailability',
      'servicePackage',
      'vehicle',
      'driverInvite',
      'driver',
      'partnerCompany',
      'location',
      'network',
    ];

    for (const model of models) {
      await (this as any)[model].deleteMany();
    }
  }
}
