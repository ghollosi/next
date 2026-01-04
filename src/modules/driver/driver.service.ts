import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Driver, DriverInvite, DriverInviteStatus, DriverApprovalStatus } from '@prisma/client';
import { createHash } from 'crypto';

@Injectable()
export class DriverService {
  constructor(private readonly prisma: PrismaService) {}

  private hashPin(pin: string): string {
    return createHash('sha256').update(pin).digest('hex');
  }

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async findById(networkId: string, id: string): Promise<Driver> {
    const driver = await this.prisma.driver.findFirst({
      where: {
        id,
        networkId,
        deletedAt: null,
      },
      include: {
        partnerCompany: true,
      },
    });

    if (!driver) {
      throw new NotFoundException(`Driver not found`);
    }

    return driver;
  }

  async findByPartnerCompany(
    networkId: string,
    partnerCompanyId: string,
  ): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: {
        networkId,
        partnerCompanyId,
        deletedAt: null,
      },
      orderBy: {
        lastName: 'asc',
      },
    });
  }

  async findAll(networkId: string): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: {
        networkId,
        deletedAt: null,
      },
      include: {
        partnerCompany: true,
      },
      orderBy: {
        lastName: 'asc',
      },
    });
  }

  async create(
    networkId: string,
    data: {
      partnerCompanyId: string;
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
      pin: string;
    },
  ): Promise<Driver & { invite: DriverInvite }> {
    // Create driver with hashed PIN
    const driver = await this.prisma.driver.create({
      data: {
        networkId,
        partnerCompanyId: data.partnerCompanyId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        pinHash: this.hashPin(data.pin),
      },
    });

    // Generate invite code
    let inviteCode: string;
    let isUnique = false;

    while (!isUnique) {
      inviteCode = this.generateInviteCode();
      const existing = await this.prisma.driverInvite.findUnique({
        where: { inviteCode },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    // Create invite with 30 day expiration
    const invite = await this.prisma.driverInvite.create({
      data: {
        networkId,
        driverId: driver.id,
        inviteCode: inviteCode!,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { ...driver, invite };
  }

  async update(
    networkId: string,
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      isActive?: boolean;
    },
  ): Promise<Driver> {
    await this.findById(networkId, id);

    return this.prisma.driver.update({
      where: { id },
      data,
    });
  }

  async updatePin(networkId: string, id: string, newPin: string): Promise<Driver> {
    await this.findById(networkId, id);

    return this.prisma.driver.update({
      where: { id },
      data: {
        pinHash: this.hashPin(newPin),
      },
    });
  }

  async softDelete(networkId: string, id: string): Promise<Driver> {
    await this.findById(networkId, id);

    return this.prisma.driver.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async activateByInviteCode(
    inviteCode: string,
    pin: string,
  ): Promise<Driver & { partnerCompany: { id: string; name: string; networkId: string } }> {
    // Find the invite
    const invite = await this.prisma.driverInvite.findUnique({
      where: { inviteCode },
      include: {
        driver: {
          include: {
            partnerCompany: true,
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite code');
    }

    // Allow already activated drivers to login again (re-authentication)
    // Only block expired or revoked invites
    if (invite.status === DriverInviteStatus.EXPIRED || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite code has expired');
    }

    if (invite.status === DriverInviteStatus.REVOKED) {
      throw new BadRequestException('Invite code has been revoked');
    }

    // Verify PIN
    const hashedPin = this.hashPin(pin);
    if (invite.driver.pinHash !== hashedPin) {
      throw new UnauthorizedException('Invalid PIN');
    }

    // Activate the invite if not already activated
    if (invite.status === DriverInviteStatus.PENDING) {
      await this.prisma.driverInvite.update({
        where: { id: invite.id },
        data: {
          status: DriverInviteStatus.ACTIVATED,
          activatedAt: new Date(),
        },
      });
    }

    return invite.driver;
  }

  async validateDriverPin(
    networkId: string,
    driverId: string,
    pin: string,
  ): Promise<boolean> {
    const driver = await this.findById(networkId, driverId);
    return driver.pinHash === this.hashPin(pin);
  }

  async getInvite(driverId: string): Promise<DriverInvite | null> {
    return this.prisma.driverInvite.findUnique({
      where: { driverId },
    });
  }

  async regenerateInvite(
    networkId: string,
    driverId: string,
  ): Promise<DriverInvite> {
    await this.findById(networkId, driverId);

    // Revoke existing invite if any
    await this.prisma.driverInvite.updateMany({
      where: {
        driverId,
        status: DriverInviteStatus.PENDING,
      },
      data: {
        status: DriverInviteStatus.REVOKED,
      },
    });

    // Generate new invite code
    let inviteCode: string;
    let isUnique = false;

    while (!isUnique) {
      inviteCode = this.generateInviteCode();
      const existing = await this.prisma.driverInvite.findUnique({
        where: { inviteCode },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    // Check if invite exists for this driver
    const existingInvite = await this.prisma.driverInvite.findUnique({
      where: { driverId },
    });

    if (existingInvite) {
      return this.prisma.driverInvite.update({
        where: { driverId },
        data: {
          inviteCode: inviteCode!,
          status: DriverInviteStatus.PENDING,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          activatedAt: null,
        },
      });
    }

    return this.prisma.driverInvite.create({
      data: {
        networkId,
        driverId,
        inviteCode: inviteCode!,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // =========================================================================
  // SELF-REGISTRATION (Önregisztráció)
  // =========================================================================

  async selfRegister(
    networkId: string,
    data: {
      partnerCompanyId: string;
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
      pin: string;
    },
  ): Promise<Driver> {
    // Create driver with PENDING approval status
    const driver = await this.prisma.driver.create({
      data: {
        networkId,
        partnerCompanyId: data.partnerCompanyId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        pinHash: this.hashPin(data.pin),
        approvalStatus: DriverApprovalStatus.PENDING,
        isActive: false, // Not active until approved
      },
    });

    return driver;
  }

  async findPendingApproval(networkId: string): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: {
        networkId,
        approvalStatus: DriverApprovalStatus.PENDING,
        deletedAt: null,
      },
      include: {
        partnerCompany: true,
        vehicles: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async approve(
    networkId: string,
    driverId: string,
    approvedByUserId: string,
  ): Promise<Driver & { invite: DriverInvite }> {
    const driver = await this.findById(networkId, driverId);

    if (driver.approvalStatus !== DriverApprovalStatus.PENDING) {
      throw new BadRequestException('Driver is not pending approval');
    }

    // Update driver status
    const updatedDriver = await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        approvalStatus: DriverApprovalStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId,
        isActive: true,
      },
    });

    // Generate invite code for the approved driver
    let inviteCode: string;
    let isUnique = false;

    while (!isUnique) {
      inviteCode = this.generateInviteCode();
      const existing = await this.prisma.driverInvite.findUnique({
        where: { inviteCode },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    // Create invite
    const invite = await this.prisma.driverInvite.create({
      data: {
        networkId,
        driverId,
        inviteCode: inviteCode!,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { ...updatedDriver, invite };
  }

  async reject(
    networkId: string,
    driverId: string,
    reason: string,
    rejectedByUserId: string,
  ): Promise<Driver> {
    const driver = await this.findById(networkId, driverId);

    if (driver.approvalStatus !== DriverApprovalStatus.PENDING) {
      throw new BadRequestException('Driver is not pending approval');
    }

    return this.prisma.driver.update({
      where: { id: driverId },
      data: {
        approvalStatus: DriverApprovalStatus.REJECTED,
        rejectionReason: reason,
        approvedByUserId: rejectedByUserId, // Same field for who handled it
        approvedAt: new Date(),
      },
    });
  }

  async checkApprovalStatus(
    networkId: string,
    driverId: string,
  ): Promise<{ status: DriverApprovalStatus; rejectionReason?: string }> {
    const driver = await this.findById(networkId, driverId);
    return {
      status: driver.approvalStatus,
      rejectionReason: driver.rejectionReason || undefined,
    };
  }
}
