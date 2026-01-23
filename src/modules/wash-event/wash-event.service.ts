import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WashEvent, WashEventStatus, WashEntryMode, VehicleType } from '@prisma/client';
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

  /**
   * Look up the price for a service package + vehicle type.
   * First checks PartnerCustomPrice, then falls back to ServicePrice.
   */
  private async lookupPrice(
    networkId: string,
    servicePackageId: string,
    vehicleType: VehicleType,
    partnerCompanyId?: string | null,
  ): Promise<number> {
    // Check partner custom price first
    if (partnerCompanyId) {
      const customPrice = await this.prisma.partnerCustomPrice.findFirst({
        where: {
          networkId,
          partnerCompanyId,
          servicePackageId,
          vehicleType,
          isActive: true,
        },
      });
      if (customPrice) {
        return Number(customPrice.price);
      }
    }

    // Fall back to base service price
    const basePrice = await this.prisma.servicePrice.findFirst({
      where: {
        networkId,
        servicePackageId,
        vehicleType,
        isActive: true,
      },
    });

    return basePrice ? Number(basePrice.price) : 0;
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
        services: {
          include: {
            servicePackage: true,
          },
        },
      },
    });

    if (!washEvent) {
      throw new NotFoundException(`Wash event not found`);
    }

    return washEvent;
  }

  /**
   * Find wash event by ID with driver ownership check.
   * Used by PWA endpoints to prevent IDOR - drivers can only access their own wash events.
   */
  async findByIdForDriver(id: string, driverId: string): Promise<WashEvent> {
    const washEvent = await this.prisma.washEvent.findFirst({
      where: {
        id,
        driverId,
      },
      include: {
        location: true,
        partnerCompany: true,
        servicePackage: true,
        driver: true,
        tractorVehicle: true,
        trailerVehicle: true,
        services: {
          include: {
            servicePackage: true,
          },
        },
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
          services: {
            include: {
              servicePackage: true,
            },
          },
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

  async findByNetwork(
    networkId: string,
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
          location: true,
          partnerCompany: true,
          servicePackage: true,
          driver: true,
          tractorVehicle: true,
          trailerVehicle: true,
          services: {
            include: {
              servicePackage: true,
            },
          },
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

  async findByPartnerCompany(
    networkId: string,
    partnerCompanyId: string,
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
      partnerCompanyId,
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
          location: true,
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

    // Validate location exists and check visibility rules
    // Privát ügyfél: bármely PUBLIC helyszínt elérheti (cross-network)
    // Flottás sofőr: csak saját network helyszíneit, visibility szabályok szerint
    const isPrivateCustomer = driver.isPrivateCustomer || !driver.partnerCompanyId;

    let location;
    if (isPrivateCustomer) {
      // Privát ügyfél: ÖSSZES network PUBLIC helyszíneit elérheti
      location = await this.prisma.location.findFirst({
        where: {
          id: input.locationId,
          visibility: 'PUBLIC',
          isActive: true,
          deletedAt: null,
        },
      });
    } else {
      // Flottás sofőr: csak saját network helyszínei, visibility szabályok szerint
      location = await this.prisma.location.findFirst({
        where: {
          id: input.locationId,
          networkId,
          isActive: true,
          deletedAt: null,
          OR: [
            { visibility: 'PUBLIC' },
            { visibility: 'NETWORK_ONLY' },
            {
              visibility: 'DEDICATED',
              dedicatedPartnerIds: { has: driver.partnerCompanyId },
            },
          ],
        },
      });
    }

    if (!location) {
      throw new BadRequestException('Location not found, inactive, or not accessible');
    }

    // Use the location's networkId for the wash event (may differ for private customers)
    const washEventNetworkId = location.networkId;

    // Determine services to use (new or legacy format)
    const hasMultipleServices = input.services && input.services.length > 0;
    const primaryServicePackageId = hasMultipleServices
      ? input.services![0].servicePackageId
      : input.servicePackageId;

    if (!primaryServicePackageId) {
      throw new BadRequestException('At least one service package is required');
    }

    // Validate primary service package is available at location
    // Use the location's networkId for cross-network support
    const serviceAvailability =
      await this.prisma.locationServiceAvailability.findFirst({
        where: {
          networkId: washEventNetworkId,
          locationId: input.locationId,
          servicePackageId: primaryServicePackageId,
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
    // Járművek a sofőr networkjében vannak (nem a helyszín networkjében)
    if (input.tractorVehicleId) {
      const tractorVehicle = await this.prisma.vehicle.findFirst({
        where: {
          id: input.tractorVehicleId,
          networkId, // Driver's networkId (from session)
          // Privát ügyfélnél nincs partnerCompanyId, így ő saját járművet használ
          ...(driver.partnerCompanyId
            ? { partnerCompanyId: driver.partnerCompanyId }
            : { driverId: driver.id }),
          category: { in: ['TRACTOR', 'SOLO'] }, // Allow TRACTOR or SOLO vehicles as primary vehicle
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
          networkId, // Driver's networkId (from session)
          // Privát ügyfélnél nincs partnerCompanyId, így ő saját járművet használ
          ...(driver.partnerCompanyId
            ? { partnerCompanyId: driver.partnerCompanyId }
            : { driverId: driver.id }),
          isActive: true,
          deletedAt: null,
        },
      });

      if (!trailerVehicle) {
        throw new BadRequestException('Invalid trailer vehicle');
      }
    }

    // Determine default vehicle type based on location type
    const defaultVehicleType: VehicleType = location.locationType === 'CAR_WASH'
      ? VehicleType.CAR
      : VehicleType.SEMI_TRUCK;

    // Prepare services data if using multiple services - with pricing lookup
    let servicesData: any[] | undefined;
    let calculatedTotalPrice = 0;

    if (hasMultipleServices) {
      servicesData = [];
      for (const svc of input.services!) {
        const vType = (svc.vehicleType as VehicleType) || defaultVehicleType;
        const qty = svc.quantity || 1;
        const unitPrice = await this.lookupPrice(
          washEventNetworkId,
          svc.servicePackageId,
          vType,
          driver.partnerCompanyId,
        );
        const svcTotal = unitPrice * qty;
        calculatedTotalPrice += svcTotal;
        servicesData.push({
          servicePackageId: svc.servicePackageId,
          vehicleType: vType,
          unitPrice,
          quantity: qty,
          totalPrice: svcTotal,
          vehicleRole: svc.vehicleRole || null,
          plateNumber: svc.plateNumber?.toUpperCase() ||
            (svc.vehicleRole === 'TRAILER'
              ? input.trailerPlateManual?.toUpperCase()
              : input.tractorPlateManual?.toUpperCase()) ||
            null,
        });
      }
    } else {
      // Single service - look up price using location-based vehicle type
      const unitPrice = await this.lookupPrice(
        washEventNetworkId,
        primaryServicePackageId,
        defaultVehicleType,
        driver.partnerCompanyId,
      );
      calculatedTotalPrice = unitPrice;
    }

    // Create the wash event
    // Privát ügyfélnél a wash event a helyszín networkjébe kerül (cross-network támogatás)
    const washEvent = await this.prisma.washEvent.create({
      data: {
        networkId: washEventNetworkId,
        locationId: input.locationId,
        partnerCompanyId: driver.partnerCompanyId,
        servicePackageId: primaryServicePackageId,
        entryMode: WashEntryMode.QR_DRIVER,
        status: WashEventStatus.CREATED,
        totalPrice: calculatedTotalPrice,
        finalPrice: calculatedTotalPrice,
        driverId: input.driverId,
        tractorVehicleId: input.tractorVehicleId,
        tractorPlateManual: input.tractorPlateManual?.toUpperCase(),
        trailerVehicleId: input.trailerVehicleId,
        trailerPlateManual: input.trailerPlateManual?.toUpperCase(),
        services: servicesData ? { create: servicesData } : undefined,
      },
      include: {
        location: true,
        partnerCompany: true,
        servicePackage: true,
        driver: true,
        tractorVehicle: true,
        trailerVehicle: true,
        services: {
          include: {
            servicePackage: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId: washEventNetworkId,
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

    // Look up price for the service
    const operatorPrice = await this.lookupPrice(
      networkId,
      input.servicePackageId,
      'SEMI_TRUCK' as VehicleType,
      input.partnerCompanyId,
    );

    // Create the wash event
    const washEvent = await this.prisma.washEvent.create({
      data: {
        networkId,
        locationId: input.locationId,
        partnerCompanyId: input.partnerCompanyId,
        servicePackageId: input.servicePackageId,
        entryMode: WashEntryMode.MANUAL_OPERATOR,
        status: WashEventStatus.CREATED,
        totalPrice: operatorPrice,
        finalPrice: operatorPrice,
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
