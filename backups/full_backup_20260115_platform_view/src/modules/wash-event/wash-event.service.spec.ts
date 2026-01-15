import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WashEventService } from './wash-event.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WashEventStatus, WashEntryMode } from '@prisma/client';

describe('WashEventService', () => {
  let service: WashEventService;
  let prismaService: PrismaService;
  let auditLogService: AuditLogService;

  const mockPrismaService = {
    washEvent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    driver: {
      findFirst: jest.fn(),
    },
    location: {
      findFirst: jest.fn(),
    },
    locationServiceAvailability: {
      findFirst: jest.fn(),
    },
    partnerCompany: {
      findFirst: jest.fn(),
    },
    vehicle: {
      findFirst: jest.fn(),
    },
  };

  const mockAuditLogService = {
    log: jest.fn(),
  };

  const networkId = 'test-network-id';
  const locationId = 'test-location-id';
  const driverId = 'test-driver-id';
  const partnerCompanyId = 'test-partner-company-id';
  const servicePackageId = 'test-service-package-id';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WashEventService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<WashEventService>(WashEventService);
    prismaService = module.get<PrismaService>(PrismaService);
    auditLogService = module.get<AuditLogService>(AuditLogService);

    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a wash event when found', async () => {
      const mockWashEvent = {
        id: 'wash-event-id',
        networkId,
        status: WashEventStatus.CREATED,
      };

      mockPrismaService.washEvent.findFirst.mockResolvedValue(mockWashEvent);

      const result = await service.findById(networkId, 'wash-event-id');

      expect(result).toEqual(mockWashEvent);
      expect(mockPrismaService.washEvent.findFirst).toHaveBeenCalledWith({
        where: { id: 'wash-event-id', networkId },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrismaService.washEvent.findFirst.mockResolvedValue(null);

      await expect(service.findById(networkId, 'non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createQrDriver', () => {
    const validInput = {
      entryMode: WashEntryMode.QR_DRIVER,
      locationId,
      driverId,
      servicePackageId,
      tractorPlateManual: 'ABC123',
    };

    const mockDriver = {
      id: driverId,
      networkId,
      partnerCompanyId,
      isActive: true,
    };

    const mockLocation = {
      id: locationId,
      networkId,
      isActive: true,
    };

    const mockServiceAvailability = {
      id: 'service-availability-id',
      isActive: true,
    };

    beforeEach(() => {
      mockPrismaService.driver.findFirst.mockResolvedValue(mockDriver);
      mockPrismaService.location.findFirst.mockResolvedValue(mockLocation);
      mockPrismaService.locationServiceAvailability.findFirst.mockResolvedValue(
        mockServiceAvailability,
      );
    });

    it('should create a wash event with valid input', async () => {
      const mockCreatedEvent = {
        id: 'new-wash-event-id',
        networkId,
        locationId,
        partnerCompanyId,
        servicePackageId,
        entryMode: WashEntryMode.QR_DRIVER,
        status: WashEventStatus.CREATED,
        driverId,
        tractorPlateManual: 'ABC123',
      };

      mockPrismaService.washEvent.create.mockResolvedValue(mockCreatedEvent);

      const result = await service.createQrDriver(networkId, validInput, {
        actorType: 'DRIVER',
        actorId: driverId,
      });

      expect(result).toEqual(mockCreatedEvent);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          networkId,
          washEventId: 'new-wash-event-id',
          action: 'CREATE',
          actorType: 'DRIVER',
        }),
      );
    });

    it('should throw BadRequestException when driver not found', async () => {
      mockPrismaService.driver.findFirst.mockResolvedValue(null);

      await expect(
        service.createQrDriver(networkId, validInput, {
          actorType: 'DRIVER',
          actorId: driverId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when location not found', async () => {
      mockPrismaService.location.findFirst.mockResolvedValue(null);

      await expect(
        service.createQrDriver(networkId, validInput, {
          actorType: 'DRIVER',
          actorId: driverId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when service not available at location', async () => {
      mockPrismaService.locationServiceAvailability.findFirst.mockResolvedValue(null);

      await expect(
        service.createQrDriver(networkId, validInput, {
          actorType: 'DRIVER',
          actorId: driverId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no tractor info provided', async () => {
      const invalidInput = {
        ...validInput,
        tractorPlateManual: undefined,
        tractorVehicleId: undefined,
      };

      await expect(
        service.createQrDriver(networkId, invalidInput, {
          actorType: 'DRIVER',
          actorId: driverId,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('State Transitions', () => {
    const mockWashEvent = (status: WashEventStatus) => ({
      id: 'wash-event-id',
      networkId,
      status,
      location: {},
      partnerCompany: {},
      servicePackage: {},
    });

    describe('authorize', () => {
      it('should transition from CREATED to AUTHORIZED', async () => {
        const event = mockWashEvent(WashEventStatus.CREATED);
        mockPrismaService.washEvent.findFirst.mockResolvedValue(event);
        mockPrismaService.washEvent.update.mockResolvedValue({
          ...event,
          status: WashEventStatus.AUTHORIZED,
          authorizedAt: new Date(),
        });

        const result = await service.authorize(networkId, 'wash-event-id', {
          actorType: 'USER',
          actorId: 'user-id',
        });

        expect(result.status).toBe(WashEventStatus.AUTHORIZED);
        expect(mockAuditLogService.log).toHaveBeenCalled();
      });

      it('should throw BadRequestException for invalid transition', async () => {
        const event = mockWashEvent(WashEventStatus.COMPLETED);
        mockPrismaService.washEvent.findFirst.mockResolvedValue(event);

        await expect(
          service.authorize(networkId, 'wash-event-id', {
            actorType: 'USER',
            actorId: 'user-id',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('start', () => {
      it('should transition from AUTHORIZED to IN_PROGRESS', async () => {
        const event = mockWashEvent(WashEventStatus.AUTHORIZED);
        mockPrismaService.washEvent.findFirst.mockResolvedValue(event);
        mockPrismaService.washEvent.update.mockResolvedValue({
          ...event,
          status: WashEventStatus.IN_PROGRESS,
          startedAt: new Date(),
        });

        const result = await service.start(networkId, 'wash-event-id', {
          actorType: 'USER',
          actorId: 'user-id',
        });

        expect(result.status).toBe(WashEventStatus.IN_PROGRESS);
      });

      it('should throw for transition from CREATED', async () => {
        const event = mockWashEvent(WashEventStatus.CREATED);
        mockPrismaService.washEvent.findFirst.mockResolvedValue(event);

        await expect(
          service.start(networkId, 'wash-event-id', {
            actorType: 'USER',
            actorId: 'user-id',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('complete', () => {
      it('should transition from IN_PROGRESS to COMPLETED', async () => {
        const event = mockWashEvent(WashEventStatus.IN_PROGRESS);
        mockPrismaService.washEvent.findFirst.mockResolvedValue(event);
        mockPrismaService.washEvent.update.mockResolvedValue({
          ...event,
          status: WashEventStatus.COMPLETED,
          completedAt: new Date(),
        });

        const result = await service.complete(networkId, 'wash-event-id', {
          actorType: 'USER',
          actorId: 'user-id',
        });

        expect(result.status).toBe(WashEventStatus.COMPLETED);
      });
    });

    describe('reject', () => {
      it('should transition from CREATED to REJECTED', async () => {
        const event = mockWashEvent(WashEventStatus.CREATED);
        mockPrismaService.washEvent.findFirst.mockResolvedValue(event);
        mockPrismaService.washEvent.update.mockResolvedValue({
          ...event,
          status: WashEventStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: 'Invalid vehicle',
        });

        const result = await service.reject(
          networkId,
          'wash-event-id',
          'Invalid vehicle',
          { actorType: 'USER', actorId: 'user-id' },
        );

        expect(result.status).toBe(WashEventStatus.REJECTED);
        expect(result.rejectionReason).toBe('Invalid vehicle');
      });

      it('should transition from AUTHORIZED to REJECTED', async () => {
        const event = mockWashEvent(WashEventStatus.AUTHORIZED);
        mockPrismaService.washEvent.findFirst.mockResolvedValue(event);
        mockPrismaService.washEvent.update.mockResolvedValue({
          ...event,
          status: WashEventStatus.REJECTED,
        });

        const result = await service.reject(
          networkId,
          'wash-event-id',
          'Test reason',
          { actorType: 'USER', actorId: 'user-id' },
        );

        expect(result.status).toBe(WashEventStatus.REJECTED);
      });

      it('should throw for transition from COMPLETED', async () => {
        const event = mockWashEvent(WashEventStatus.COMPLETED);
        mockPrismaService.washEvent.findFirst.mockResolvedValue(event);

        await expect(
          service.reject(networkId, 'wash-event-id', 'Test reason', {
            actorType: 'USER',
            actorId: 'user-id',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('lock', () => {
      it('should transition from COMPLETED to LOCKED', async () => {
        const event = mockWashEvent(WashEventStatus.COMPLETED);
        mockPrismaService.washEvent.findFirst.mockResolvedValue(event);
        mockPrismaService.washEvent.update.mockResolvedValue({
          ...event,
          status: WashEventStatus.LOCKED,
          lockedAt: new Date(),
        });

        const result = await service.lock(networkId, 'wash-event-id', {
          actorType: 'SYSTEM',
        });

        expect(result.status).toBe(WashEventStatus.LOCKED);
      });

      it('should throw for transition from IN_PROGRESS', async () => {
        const event = mockWashEvent(WashEventStatus.IN_PROGRESS);
        mockPrismaService.washEvent.findFirst.mockResolvedValue(event);

        await expect(
          service.lock(networkId, 'wash-event-id', {
            actorType: 'SYSTEM',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });
});
