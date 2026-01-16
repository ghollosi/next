import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { DriverService } from './driver.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DriverInviteStatus } from '@prisma/client';

describe('DriverService', () => {
  let service: DriverService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    driver: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    driverInvite: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const networkId = 'test-network-id';
  const partnerCompanyId = 'test-partner-company-id';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DriverService>(DriverService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a driver when found', async () => {
      const mockDriver = {
        id: 'driver-id',
        networkId,
        firstName: 'John',
        lastName: 'Doe',
        partnerCompany: { id: partnerCompanyId, name: 'Test Company' },
      };

      mockPrismaService.driver.findFirst.mockResolvedValue(mockDriver);

      const result = await service.findById(networkId, 'driver-id');

      expect(result).toEqual(mockDriver);
      expect(mockPrismaService.driver.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'driver-id',
          networkId,
          deletedAt: null,
        },
        include: {
          partnerCompany: true,
        },
      });
    });

    it('should throw NotFoundException when driver not found', async () => {
      mockPrismaService.driver.findFirst.mockResolvedValue(null);

      await expect(
        service.findById(networkId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a driver with an invite', async () => {
      const mockDriver = {
        id: 'new-driver-id',
        networkId,
        partnerCompanyId,
        firstName: 'Jane',
        lastName: 'Smith',
        pinHash: expect.any(String),
      };

      const mockInvite = {
        id: 'invite-id',
        driverId: 'new-driver-id',
        inviteCode: 'ABC123',
        status: DriverInviteStatus.PENDING,
      };

      mockPrismaService.driver.create.mockResolvedValue(mockDriver);
      mockPrismaService.driverInvite.findUnique.mockResolvedValue(null);
      mockPrismaService.driverInvite.create.mockResolvedValue(mockInvite);

      const result = await service.create(networkId, {
        partnerCompanyId,
        firstName: 'Jane',
        lastName: 'Smith',
        pin: '1234',
      });

      expect(result.id).toBe('new-driver-id');
      expect(result.invite).toBeDefined();
      expect(result.invite.inviteCode).toHaveLength(6);
    });
  });

  describe('activateByInviteCode', () => {
    const mockDriver = {
      id: 'driver-id',
      networkId,
      firstName: 'John',
      lastName: 'Doe',
      pinHash: expect.any(String),
      partnerCompany: { id: partnerCompanyId, name: 'Test Company', networkId },
    };

    it('should activate a valid invite with correct PIN', async () => {
      const mockInvite = {
        id: 'invite-id',
        inviteCode: 'ABC123',
        status: DriverInviteStatus.PENDING,
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        driver: {
          ...mockDriver,
          // SHA-256 hash of '1234'
          pinHash:
            '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
        },
      };

      mockPrismaService.driverInvite.findUnique.mockResolvedValue(mockInvite);
      mockPrismaService.driverInvite.update.mockResolvedValue({
        ...mockInvite,
        status: DriverInviteStatus.ACTIVATED,
      });

      const result = await service.activateByInviteCode('ABC123', '1234');

      expect(result).toBeDefined();
      expect(mockPrismaService.driverInvite.update).toHaveBeenCalledWith({
        where: { id: 'invite-id' },
        data: {
          status: DriverInviteStatus.ACTIVATED,
          activatedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException for invalid invite code', async () => {
      mockPrismaService.driverInvite.findUnique.mockResolvedValue(null);

      await expect(
        service.activateByInviteCode('INVALID', '1234'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for already activated invite', async () => {
      const mockInvite = {
        id: 'invite-id',
        inviteCode: 'ABC123',
        status: DriverInviteStatus.ACTIVATED,
        driver: mockDriver,
      };

      mockPrismaService.driverInvite.findUnique.mockResolvedValue(mockInvite);

      await expect(
        service.activateByInviteCode('ABC123', '1234'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired invite', async () => {
      const mockInvite = {
        id: 'invite-id',
        inviteCode: 'ABC123',
        status: DriverInviteStatus.PENDING,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
        driver: mockDriver,
      };

      mockPrismaService.driverInvite.findUnique.mockResolvedValue(mockInvite);

      await expect(
        service.activateByInviteCode('ABC123', '1234'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for wrong PIN', async () => {
      const mockInvite = {
        id: 'invite-id',
        inviteCode: 'ABC123',
        status: DriverInviteStatus.PENDING,
        expiresAt: new Date(Date.now() + 86400000),
        driver: {
          ...mockDriver,
          pinHash: 'different-hash',
        },
      };

      mockPrismaService.driverInvite.findUnique.mockResolvedValue(mockInvite);

      await expect(
        service.activateByInviteCode('ABC123', '1234'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a driver', async () => {
      const mockDriver = {
        id: 'driver-id',
        networkId,
        isActive: true,
        deletedAt: null,
      };

      mockPrismaService.driver.findFirst.mockResolvedValue(mockDriver);
      mockPrismaService.driver.update.mockResolvedValue({
        ...mockDriver,
        isActive: false,
        deletedAt: new Date(),
      });

      const result = await service.softDelete(networkId, 'driver-id');

      expect(result.isActive).toBe(false);
      expect(result.deletedAt).toBeDefined();
      expect(mockPrismaService.driver.update).toHaveBeenCalledWith({
        where: { id: 'driver-id' },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
        },
      });
    });
  });
});
