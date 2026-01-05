import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WashEvent, WashEventStatus, WashEntryMode } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  VALID_STATE_TRANSITIONS,
  CreateWashEventInput,
  CreateWashEventQrDriverInput,
  CreateWashEventManualOperatorInput,
  WashEventTransitionContext,
} from './wash-event.types';

@Injectable()
export class WashEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private validateStateTransition(
    currentStatus: WashEventStatus,
    targetStatus: WashEventStatus,
  ): void {
    const validTransitions = VALID_STATE_TRANSITIONS[currentStatus];

    if (!validTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid state transition from ${currentStatus} to ${targetStatus}`,
      );
    }
  }

  private isImmutable(status: WashEventStatus): boolean {
    return (
      status === WashEventStatus.COMPLETED ||
      status === WashEventStatus.LOCKED
    );
  }

  async findById(networkId: string, id: string): Promise<WashEvent> {
    const washEvent = await this.prisma.washEvent.findFirst({
      where: {
        id,
        networkId,
      },
      include: {
        location: true,
        partnerCompany: true,
        servicePackage: true,
        driver: true,
        tractorVehicle: true,
        trailerVehicle: true,
      },
    });

    if (!washEvent) {
      throw new NotFoundException(`Wash event not found`);
    }

    return washEvent;
  }

  async findByLocation(
    networkId: string,
    locationId: string,
    options?: {
      status?: WashEventStatus;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: WashEvent[]; total: number }> {
    const where: any = {
      networkId,
      locationId,
    };

    if (options?.status) {
      where.status = options.status;
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
      this.prisma.washEvent.findMany({
        where,
        include: {
          partnerCompany: true,
          servicePackage: true,
          driver: true,
          tractorVehicle: true,
          trailerVehicle: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.washEvent.count({ where }),
    ]);

    return { data, total };
  }

  async findByDriver(
    networkId: string,
    driverId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: WashEvent[]; total: number }> {
    const where = {
      networkId,
      driverId,
    };

    const [data, total] = await Promise.all([
      this.prisma.washEvent.findMany({
        where,
        include: {
          location: true,
          servicePackage: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.washEvent.count({ where }),
    ]);

    return { data, total };
  }

  async createQrDriver(
    networkId: string,
    input: CreateWashEventQrDriverInput,
    context: WashEventTransitionContext,
  ): Promise<WashEvent> {
    // Validate driver exists and get partner company
    const driver = await this.prisma.driver.findFirst({
      where: {
        id: input.driverId,
        networkId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!driver) {
      throw new BadRequestException('Driver not found or inactive');
    }

    // Validate location exists
    const location = await this.prisma.location.findFirst({
      where: {
        id: input.locationId,
        networkId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!location) {
      throw new BadRequestException('Location not found or inactive');
    }

    // Validate service package is available at location
    const serviceAvailability =
      await this.prisma.locationServiceAvailability.findFirst({
        where: {
          networkId,
          locationId: input.locationId,
          servicePackageId: input.servicePackageId,
          isActive: true,
        },
      });

    if (!serviceAvailability) {
      throw new BadRequestException(
        'Service package not available at this location',
      );
    }

    // Validate tractor: either vehicle ID or manual plate required
    if (!input.tractorVehicleId && !input.tractorPlateManual) {
      throw new BadRequestException(
        'Tractor vehicle ID or manual plate is required',
      );
    }

    // If tractor vehicle ID provided, validate it
    if (input.tractorVehicleId) {
      const tractorVehicle = await this.prisma.vehicle.findFirst({
        where: {
          id: input.tractorVehicleId,
          networkId,
          partnerCompanyId: driver.partnerCompanyId,
          type: 'TRACTOR',
          isActive: true,
          deletedAt: null,
        },
      });

      if (!tractorVehicle) {
        throw new BadRequestException('Invalid tractor vehicle');
      }
    }

    // If trailer vehicle ID provided, validate it
    if (input.trailerVehicleId) {
      const trailerVehicle = await this.prisma.vehicle.findFirst({
        where: {
          id: input.trailerVehicleId,
          networkId,
          partnerCompanyId: driver.partnerCompanyId,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!trailerVehicle) {
        throw new BadRequestException('Invalid trailer vehicle');
      }
    }

    // Create the wash event
    const washEvent = await this.prisma.washEvent.create({
      data: {
        networkId,
        locationId: input.locationId,
        partnerCompanyId: driver.partnerCompanyId,
        servicePackageId: input.servicePackageId,
        entryMode: WashEntryMode.QR_DRIVER,
        status: WashEventStatus.CREATED,
        driverId: input.driverId,
        tractorVehicleId: input.tractorVehicleId,
        tractorPlateManual: input.tractorPlateManual?.toUpperCase(),
        trailerVehicleId: input.trailerVehicleId,
        trailerPlateManual: input.trailerPlateManual?.toUpperCase(),
      },
      include: {
        location: true,
        partnerCompany: true,
        servicePackage: true,
        driver: true,
        tractorVehicle: true,
        trailerVehicle: true,
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      washEventId: washEvent.id,
      action: 'CREATE',
      actorType: context.actorType,
      actorId: context.actorId,
      newData: washEvent,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return washEvent;
  }

  async createManualOperator(
    networkId: string,
    input: CreateWashEventManualOperatorInput,
    context: WashEventTransitionContext,
  ): Promise<WashEvent> {
    // Validate partner company exists
    const partnerCompany = await this.prisma.partnerCompany.findFirst({
      where: {
        id: input.partnerCompanyId,
        networkId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!partnerCompany) {
      throw new BadRequestException('Partner company not found or inactive');
    }

    // Validate location exists
    const location = await this.prisma.location.findFirst({
      where: {
        id: input.locationId,
        networkId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!location) {
      throw new BadRequestException('Location not found or inactive');
    }

    // Validate service package is available at location
    const serviceAvailability =
      await this.prisma.locationServiceAvailability.findFirst({
        where: {
          networkId,
          locationId: input.locationId,
          servicePackageId: input.servicePackageId,
          isActive: true,
        },
      });

    if (!serviceAvailability) {
      throw new BadRequestException(
        'Service package not available at this location',
      );
    }

    // Create the wash event
    const washEvent = await this.prisma.washEvent.create({
      data: {
        networkId,
        locationId: input.locationId,
        partnerCompanyId: input.partnerCompanyId,
        servicePackageId: input.servicePackageId,
        entryMode: WashEntryMode.MANUAL_OPERATOR,
        status: WashEventStatus.CREATED,
        driverNameManual: input.driverNameManual,
        tractorPlateManual: input.tractorPlateManual.toUpperCase(),
        trailerPlateManual: input.trailerPlateManual?.toUpperCase(),
        createdByUserId: input.createdByUserId,
      },
      include: {
        location: true,
        partnerCompany: true,
        servicePackage: true,
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      washEventId: washEvent.id,
      action: 'CREATE',
      actorType: context.actorType,
      actorId: context.actorId,
      newData: washEvent,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return washEvent;
  }

  async authorize(
    networkId: string,
    id: string,
    context: WashEventTransitionContext,
  ): Promise<WashEvent> {
    const washEvent = await this.findById(networkId, id);

    this.validateStateTransition(washEvent.status, WashEventStatus.AUTHORIZED);

    const previousData = { ...washEvent };

    const updated = await this.prisma.washEvent.update({
      where: { id },
      data: {
        status: WashEventStatus.AUTHORIZED,
        authorizedAt: new Date(),
      },
      include: {
        location: true,
        partnerCompany: true,
        servicePackage: true,
        driver: true,
        tractorVehicle: true,
        trailerVehicle: true,
      },
    });

    await this.auditLogService.log({
      networkId,
      washEventId: id,
      action: 'AUTHORIZE',
      actorType: context.actorType,
      actorId: context.actorId,
      previousData,
      newData: updated,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return updated;
  }

  async start(
    networkId: string,
    id: string,
    context: WashEventTransitionContext,
  ): Promise<WashEvent> {
    const washEvent = await this.findById(networkId, id);

    this.validateStateTransition(washEvent.status, WashEventStatus.IN_PROGRESS);

    const previousData = { ...washEvent };

    const updated = await this.prisma.washEvent.update({
      where: { id },
      data: {
        status: WashEventStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: {
        location: true,
        partnerCompany: true,
        servicePackage: true,
        driver: true,
        tractorVehicle: true,
        trailerVehicle: true,
      },
    });

    await this.auditLogService.log({
      networkId,
      washEventId: id,
      action: 'START',
      actorType: context.actorType,
      actorId: context.actorId,
      previousData,
      newData: updated,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return updated;
  }

  async complete(
    networkId: string,
    id: string,
    context: WashEventTransitionContext,
  ): Promise<WashEvent> {
    const washEvent = await this.findById(networkId, id);

    this.validateStateTransition(washEvent.status, WashEventStatus.COMPLETED);

    const previousData = { ...washEvent };

    const updated = await this.prisma.washEvent.update({
      where: { id },
      data: {
        status: WashEventStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: {
        location: true,
        partnerCompany: true,
        servicePackage: true,
        driver: true,
        tractorVehicle: true,
        trailerVehicle: true,
      },
    });

    await this.auditLogService.log({
      networkId,
      washEventId: id,
      action: 'COMPLETE',
      actorType: context.actorType,
      actorId: context.actorId,
      previousData,
      newData: updated,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return updated;
  }

  async reject(
    networkId: string,
    id: string,
    reason: string,
    context: WashEventTransitionContext,
  ): Promise<WashEvent> {
    const washEvent = await this.findById(networkId, id);

    this.validateStateTransition(washEvent.status, WashEventStatus.REJECTED);

    const previousData = { ...washEvent };

    const updated = await this.prisma.washEvent.update({
      where: { id },
      data: {
        status: WashEventStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        location: true,
        partnerCompany: true,
        servicePackage: true,
        driver: true,
        tractorVehicle: true,
        trailerVehicle: true,
      },
    });

    await this.auditLogService.log({
      networkId,
      washEventId: id,
      action: 'REJECT',
      actorType: context.actorType,
      actorId: context.actorId,
      previousData,
      newData: updated,
      metadata: { reason },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return updated;
  }

  async lock(
    networkId: string,
    id: string,
    context: WashEventTransitionContext,
  ): Promise<WashEvent> {
    const washEvent = await this.findById(networkId, id);

    this.validateStateTransition(washEvent.status, WashEventStatus.LOCKED);

    const previousData = { ...washEvent };

    const updated = await this.prisma.washEvent.update({
      where: { id },
      data: {
        status: WashEventStatus.LOCKED,
        lockedAt: new Date(),
      },
      include: {
        location: true,
        partnerCompany: true,
        servicePackage: true,
        driver: true,
        tractorVehicle: true,
        trailerVehicle: true,
      },
    });

    await this.auditLogService.log({
      networkId,
      washEventId: id,
      action: 'LOCK',
      actorType: context.actorType,
      actorId: context.actorId,
      previousData,
      newData: updated,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return updated;
  }

  // Note: No delete method - wash events are never deleted
  // Note: No update method for COMPLETED or LOCKED events - they are immutable
}
