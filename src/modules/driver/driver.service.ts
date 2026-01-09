import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { Driver, DriverInvite, DriverInviteStatus, DriverApprovalStatus } from '@prisma/client';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DriverService {
  private readonly logger = new Logger(DriverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // SECURITY: New bcrypt hashing for new PINs
  private async hashPinBcrypt(pin: string): Promise<string> {
    return bcrypt.hash(pin, 10);
  }

  // Legacy SHA-256 hash for backward compatibility during migration
  private hashPinLegacy(pin: string): string {
    return createHash('sha256').update(pin).digest('hex');
  }

  // SECURITY: Verify PIN with both bcrypt and legacy SHA-256
  private async verifyPin(pin: string, storedHash: string): Promise<boolean> {
    // Check if it's a bcrypt hash (starts with $2b$)
    if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
      return bcrypt.compare(pin, storedHash);
    }
    // Fallback to legacy SHA-256 for old hashes
    const legacyHash = this.hashPinLegacy(pin);
    return storedHash === legacyHash;
  }

  // SECURITY: Migrate legacy hash to bcrypt on successful login
  private async migrateToBcrypt(driverId: string, pin: string): Promise<void> {
    const newHash = await this.hashPinBcrypt(pin);
    await this.prisma.driver.update({
      where: { id: driverId },
      data: { pinHash: newHash },
    });
    this.logger.log(`Migrated driver ${driverId} PIN to bcrypt`);
  }

  // For new drivers, always use bcrypt
  private async hashPin(pin: string): Promise<string> {
    return this.hashPinBcrypt(pin);
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
    // Create driver with hashed PIN (bcrypt)
    const pinHash = await this.hashPin(data.pin);
    const driver = await this.prisma.driver.create({
      data: {
        networkId,
        partnerCompanyId: data.partnerCompanyId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        pinHash,
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

    const pinHash = await this.hashPin(newPin);
    return this.prisma.driver.update({
      where: { id },
      data: {
        pinHash,
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

  async activateByPhone(
    phone: string,
    pin: string,
  ): Promise<Driver & { partnerCompany: { id: string; name: string; networkId: string } }> {
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phone.replace(/[\s\-\(\)+]/g, '');
    const lastNineDigits = normalizedPhone.slice(-9);

    // Find all active drivers and match by normalized phone
    const drivers = await this.prisma.driver.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        phone: { not: null },
      },
      include: {
        partnerCompany: true,
      },
    });

    // Find driver with matching phone (normalize both sides)
    const driver = drivers.find(d => {
      if (!d.phone) return false;
      const driverPhoneNormalized = d.phone.replace(/[\s\-\(\)+]/g, '');
      return driverPhoneNormalized.slice(-9) === lastNineDigits;
    });

    if (!driver) {
      throw new NotFoundException('Nem található sofőr ezzel a telefonszámmal');
    }

    // Check if driver is approved
    if (driver.approvalStatus !== DriverApprovalStatus.APPROVED) {
      if (driver.approvalStatus === DriverApprovalStatus.PENDING) {
        throw new BadRequestException('A regisztrációd még jóváhagyásra vár');
      }
      throw new BadRequestException('A regisztrációd el lett utasítva');
    }

    // Verify PIN (supports both bcrypt and legacy SHA-256)
    const isValidPin = await this.verifyPin(pin, driver.pinHash);
    if (!isValidPin) {
      throw new UnauthorizedException('Hibás PIN kód');
    }

    // SECURITY: Migrate legacy SHA-256 to bcrypt on successful login
    if (!driver.pinHash.startsWith('$2b$') && !driver.pinHash.startsWith('$2a$')) {
      await this.migrateToBcrypt(driver.id, pin);
    }

    return driver;
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

    // Verify PIN (supports both bcrypt and legacy SHA-256)
    const isValidPin = await this.verifyPin(pin, invite.driver.pinHash);
    if (!isValidPin) {
      throw new UnauthorizedException('Invalid PIN');
    }

    // SECURITY: Migrate legacy SHA-256 to bcrypt on successful login
    if (!invite.driver.pinHash.startsWith('$2b$') && !invite.driver.pinHash.startsWith('$2a$')) {
      await this.migrateToBcrypt(invite.driver.id, pin);
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
    return this.verifyPin(pin, driver.pinHash);
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
  ): Promise<Driver & { invite: DriverInvite }> {
    // Create driver with AUTO-APPROVED status (bcrypt hash)
    const pinHash = await this.hashPin(data.pin);
    const driver = await this.prisma.driver.create({
      data: {
        networkId,
        partnerCompanyId: data.partnerCompanyId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        pinHash,
        approvalStatus: DriverApprovalStatus.APPROVED,
        approvedAt: new Date(),
        isActive: true, // Auto-approved, immediately active
      },
      include: {
        partnerCompany: true,
      },
    });

    // Generate invite code for the new driver
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

    // Send notification to network admins (non-blocking)
    this.sendNewDriverNotificationToNetworkAdmins(networkId, driver).catch(err => {
      this.logger.error(`Failed to send new driver notification: ${err.message}`);
    });

    return { ...driver, invite };
  }

  /**
   * Send email notification to all network admins about new driver registration
   */
  private async sendNewDriverNotificationToNetworkAdmins(
    networkId: string,
    driver: Driver & { partnerCompany: { name: string } | null },
  ): Promise<void> {
    // Get all network admins
    const networkAdmins = await this.prisma.networkAdmin.findMany({
      where: { networkId },
      select: { name: true, email: true },
    });

    if (networkAdmins.length === 0) {
      this.logger.warn(`No network admins found for network ${networkId}`);
      return;
    }

    const driverName = `${driver.firstName} ${driver.lastName}`;
    const partnerCompanyName = driver.partnerCompany?.name || 'Nincs megadva';

    // Send notification to each admin
    for (const admin of networkAdmins) {
      try {
        await this.emailService.sendNetworkEmail(networkId, {
          to: admin.email,
          subject: `Új sofőr regisztrált: ${driverName}`,
          html: this.generateNewDriverEmailHtml(admin.name, driverName, driver.phone, driver.email, partnerCompanyName),
          text: this.generateNewDriverEmailText(admin.name, driverName, driver.phone, driver.email, partnerCompanyName),
        });
        this.logger.log(`New driver notification sent to ${admin.email}`);
      } catch (err) {
        this.logger.error(`Failed to send notification to ${admin.email}: ${err.message}`);
      }
    }
  }

  private generateNewDriverEmailHtml(
    recipientName: string,
    driverName: string,
    driverPhone: string | null,
    driverEmail: string | null,
    partnerCompanyName: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .label { color: #6b7280; font-size: 12px; text-transform: uppercase; }
    .value { font-weight: bold; font-size: 16px; }
    .badge { display: inline-block; background: #059669; color: white; padding: 4px 12px; border-radius: 999px; font-size: 12px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>vSys Wash</h1>
      <p>Új sofőr regisztráció</p>
    </div>
    <div class="content">
      <h2>Kedves ${recipientName}!</h2>
      <p>Új sofőr regisztrált a hálózatodba. <span class="badge">Automatikusan aktiválva</span></p>

      <div class="info-box">
        <div class="label">Sofőr neve</div>
        <div class="value">${driverName}</div>
      </div>

      ${driverPhone ? `
      <div class="info-box">
        <div class="label">Telefonszám</div>
        <div class="value">${driverPhone}</div>
      </div>
      ` : ''}

      ${driverEmail ? `
      <div class="info-box">
        <div class="label">Email</div>
        <div class="value">${driverEmail}</div>
      </div>
      ` : ''}

      <div class="info-box">
        <div class="label">Partner cég</div>
        <div class="value">${partnerCompanyName}</div>
      </div>

      <p>A sofőr azonnal használhatja az alkalmazást.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} vSys Wash. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private generateNewDriverEmailText(
    recipientName: string,
    driverName: string,
    driverPhone: string | null,
    driverEmail: string | null,
    partnerCompanyName: string,
  ): string {
    return `
Kedves ${recipientName}!

Új sofőr regisztrált a hálózatodba és automatikusan aktiválva lett.

Sofőr neve: ${driverName}
${driverPhone ? `Telefonszám: ${driverPhone}` : ''}
${driverEmail ? `Email: ${driverEmail}` : ''}
Partner cég: ${partnerCompanyName}

A sofőr azonnal használhatja az alkalmazást.

© ${new Date().getFullYear()} vSys Wash
    `;
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
