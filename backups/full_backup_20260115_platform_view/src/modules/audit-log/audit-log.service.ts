import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLog, AuditAction, ActorType } from '@prisma/client';

export interface CreateAuditLogInput {
  networkId?: string; // Optional for platform-level events
  washEventId?: string;
  action: AuditAction;
  actorType: 'USER' | 'DRIVER' | 'SYSTEM' | 'OPERATOR' | 'PARTNER' | 'NETWORK_ADMIN' | 'PLATFORM_ADMIN';
  actorId?: string;
  previousData?: any;
  newData?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: CreateAuditLogInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        networkId: input.networkId,
        washEventId: input.washEventId,
        action: input.action,
        actorType: input.actorType as ActorType,
        actorId: input.actorId,
        previousData: input.previousData,
        newData: input.newData,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async findByWashEvent(
    networkId: string,
    washEventId: string,
  ): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: {
        networkId,
        washEventId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findByNetwork(
    networkId: string,
    options?: {
      action?: AuditAction;
      actorType?: ActorType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: AuditLog[]; total: number }> {
    const where: any = {
      networkId,
    };

    if (options?.action) {
      where.action = options.action;
    }

    if (options?.actorType) {
      where.actorType = options.actorType;
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          washEvent: {
            select: {
              id: true,
              status: true,
              entryMode: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: options?.limit || 100,
        skip: options?.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  }

  async findByActor(
    networkId: string,
    actorType: ActorType,
    actorId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: {
        networkId,
        actorType,
        actorId,
      },
      include: {
        washEvent: {
          select: {
            id: true,
            status: true,
            entryMode: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });
  }
}
