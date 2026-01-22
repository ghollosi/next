import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { Driver, DriverInvite, DriverInviteStatus, DriverApprovalStatus, PartnerCompany } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

// SECURITY: Type for driver without sensitive pinHash field
export type SafeDriver = Omit<Driver, 'pinHash'>;
export type SafeDriverWithPartner = SafeDriver & { partnerCompany: PartnerCompany | null };

@Injectable()
export class DriverService {
  private readonly logger = new Logger(DriverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // SECURITY: New bcrypt hashing for new PINs (12 rounds for better security)
  private async hashPinBcrypt(pin: string): Promise<string> {
    return bcrypt.hash(pin, 12);
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

  // SECURITY: Use cryptographically secure random generation for invite codes
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomBytesBuffer = randomBytes(6);
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(randomBytesBuffer[i] % chars.length);
    }
    return code;
  }

  // SECURITY: Remove pinHash from driver object and nested partnerCompany before returning to API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private omitPinHash(obj: any): any {
    if (!obj) return obj;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pinHash, ...rest } = obj;

    // Also remove pinHash from nested partnerCompany if present
    if (rest.partnerCompany && typeof rest.partnerCompany === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pinHash: partnerPinHash, ...safePartner } = rest.partnerCompany;
      rest.partnerCompany = safePartner;
    }

    return rest;
  }

  // SECURITY: Remove pinHash from array of objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private omitPinHashFromArray(items: any[]): any[] {
    return items.map(item => this.omitPinHash(item));
  }

  async findById(networkId: string, id: string): Promise<SafeDriverWithPartner> {
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

    // SECURITY: Remove pinHash before returning
    return this.omitPinHash(driver) as SafeDriverWithPartner;
  }

  async findByPartnerCompany(
    networkId: string,
    partnerCompanyId: string,
  ): Promise<SafeDriver[]> {
    const drivers = await this.prisma.driver.findMany({
      where: {
        networkId,
        partnerCompanyId,
        deletedAt: null,
      },
      orderBy: {
        lastName: 'asc',
      },
    });
    // SECURITY: Remove pinHash before returning
    return this.omitPinHashFromArray(drivers);
  }

  async findAll(networkId: string): Promise<SafeDriverWithPartner[]> {
    const drivers = await this.prisma.driver.findMany({
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
    // SECURITY: Remove pinHash before returning
    return this.omitPinHashFromArray(drivers) as SafeDriverWithPartner[];
  }

  async create(
    networkId: string,
    data: {
      partnerCompanyId?: string;
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
      pin: string;
    },
  ): Promise<Driver & { invite: DriverInvite }> {
    // Check for duplicate email
    if (data.email) {
      const existingByEmail = await this.prisma.driver.findFirst({
        where: {
          email: { equals: data.email.toLowerCase().trim(), mode: 'insensitive' },
          deletedAt: null,
        },
      });
      if (existingByEmail) {
        throw new ConflictException('Ezzel az email címmel már létezik sofőr.');
      }
    }

    // Check for duplicate phone
    if (data.phone) {
      const normalizedPhone = data.phone.replace(/[\s\-\(\)+]/g, '');
      const lastNineDigits = normalizedPhone.slice(-9);

      const existingDrivers = await this.prisma.driver.findMany({
        where: {
          phone: { not: null },
          deletedAt: null,
        },
        select: { phone: true },
      });

      const phoneExists = existingDrivers.some(d => {
        if (!d.phone) return false;
        const driverPhoneNormalized = d.phone.replace(/[\s\-\(\)+]/g, '');
        return driverPhoneNormalized.slice(-9) === lastNineDigits;
      });

      if (phoneExists) {
        throw new ConflictException('Ezzel a telefonszámmal már létezik sofőr.');
      }
    }

    // Create driver with hashed PIN (bcrypt)
    const pinHash = await this.hashPin(data.pin);
    const driver = await this.prisma.driver.create({
      data: {
        networkId,
        partnerCompanyId: data.partnerCompanyId || null,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        pinHash,
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        isActive: true,
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
  ): Promise<Driver & { partnerCompany: { id: string; name: string; networkId: string } | null }> {
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

  async activateByEmail(
    email: string,
    pin: string,
  ): Promise<Driver & { partnerCompany: { id: string; name: string; networkId: string } | null }> {
    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Find driver by email
    const driver = await this.prisma.driver.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        isActive: true,
        deletedAt: null,
      },
      include: {
        partnerCompany: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Nem található sofőr ezzel az email címmel');
    }

    // Check if email is verified
    if (!driver.emailVerified) {
      throw new BadRequestException('Az email cím még nincs megerősítve. Kérjük, ellenőrizd a postafiókod.');
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
  ): Promise<Driver & { partnerCompany: { id: string; name: string; networkId: string } | null }> {
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
    // SECURITY: Internal method needs full driver with pinHash
    const driver = await this.prisma.driver.findFirst({
      where: {
        id: driverId,
        networkId,
        deletedAt: null,
      },
    });
    if (!driver) {
      throw new NotFoundException(`Driver not found`);
    }
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
      partnerCompanyId?: string;  // Opcionális: privát ügyfélnek nincs partnere
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
      pin?: string;  // Opcionális ha jelszó van megadva
      password?: string;  // Email+jelszó alapú regisztráció
      // Privát ügyfél számlázási adatai (kötelező ha nincs partner)
      billingName?: string;
      billingAddress?: string;
      billingCity?: string;
      billingZipCode?: string;
      billingCountry?: string;
      billingTaxNumber?: string;
    },
  ): Promise<Driver & { invite: DriverInvite }> {
    // Check for duplicate email
    if (data.email) {
      const existingByEmail = await this.prisma.driver.findFirst({
        where: {
          email: { equals: data.email.toLowerCase().trim(), mode: 'insensitive' },
          deletedAt: null,
        },
      });
      if (existingByEmail) {
        throw new ConflictException('Ezzel az email címmel már regisztráltak. Kérjük, használd a bejelentkezés funkciót.');
      }
    }

    // Check for duplicate phone
    if (data.phone) {
      const normalizedPhone = data.phone.replace(/[\s\-\(\)+]/g, '');
      const lastNineDigits = normalizedPhone.slice(-9);

      const existingDrivers = await this.prisma.driver.findMany({
        where: {
          phone: { not: null },
          deletedAt: null,
        },
        select: { phone: true },
      });

      const phoneExists = existingDrivers.some(d => {
        if (!d.phone) return false;
        const driverPhoneNormalized = d.phone.replace(/[\s\-\(\)+]/g, '');
        return driverPhoneNormalized.slice(-9) === lastNineDigits;
      });

      if (phoneExists) {
        throw new ConflictException('Ezzel a telefonszámmal már regisztráltak. Kérjük, használd a bejelentkezés funkciót.');
      }
    }

    // Privát ügyfél esetén ellenőrizzük a számlázási adatokat
    const isPrivateCustomer = !data.partnerCompanyId;

    if (isPrivateCustomer) {
      // Privát ügyfélnél kötelező a számlázási adatok megadása
      if (!data.billingName || !data.billingAddress || !data.billingCity || !data.billingZipCode) {
        throw new BadRequestException('Privát ügyfélnek kötelező a számlázási adatok megadása');
      }
    }

    // Validáció: PIN vagy jelszó kötelező
    if (!data.pin && !data.password) {
      throw new BadRequestException('PIN kód vagy jelszó megadása kötelező');
    }

    // Jelszavas regisztrációhoz kötelező az email
    if (data.password && !data.email) {
      throw new BadRequestException('Email cím megadása kötelező jelszavas regisztrációhoz');
    }

    // Create driver with AUTO-APPROVED status (bcrypt hash)
    // Ha jelszó van, generálunk random PIN-t (csak backup, email+jelszó lesz a fő)
    let pinHash: string;
    let passwordHash: string | null = null;

    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 12);
      // Random 4 számjegyű PIN generálása backup-nak (kötelező mező)
      const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
      pinHash = await this.hashPin(randomPin);
    } else if (data.pin) {
      pinHash = await this.hashPin(data.pin);
    } else {
      // Fallback: generálunk random PIN-t ha se PIN se jelszó nincs (nem kellene ideérni)
      const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
      pinHash = await this.hashPin(randomPin);
    }

    const driver = await this.prisma.driver.create({
      data: {
        networkId,
        partnerCompanyId: data.partnerCompanyId || null,  // NULL ha privát ügyfél
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email?.toLowerCase().trim(),
        pinHash,
        passwordHash,
        approvalStatus: DriverApprovalStatus.APPROVED,
        approvedAt: new Date(),
        isActive: true, // Auto-approved, immediately active
        // Privát ügyfél mezők
        isPrivateCustomer,
        billingName: data.billingName,
        billingAddress: data.billingAddress,
        billingCity: data.billingCity,
        billingZipCode: data.billingZipCode,
        billingCountry: data.billingCountry || 'HU',
        billingTaxNumber: data.billingTaxNumber,
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
    driver: Driver & { partnerCompany: PartnerCompany | null },
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

  async findPendingApproval(networkId: string): Promise<SafeDriver[]> {
    const drivers = await this.prisma.driver.findMany({
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
    // SECURITY: Remove pinHash before returning
    return this.omitPinHashFromArray(drivers);
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

  /**
   * Függetlenné válás - sofőr leválik a partnertől és privát ügyfél lesz
   * A sofőr többé nem használhatja a partner dedikált helyszíneit,
   * és ő fizeti ezentúl a mosásait (nem a partner)
   */
  async detachFromPartner(
    driverId: string,
    billingData: {
      billingName: string;
      billingAddress: string;
      billingCity: string;
      billingZipCode: string;
      billingCountry?: string;
      billingTaxNumber?: string;
    },
  ): Promise<Driver> {
    // Keresés network nélkül - a sofőr azonosítója egyedi
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { partnerCompany: true },
    });

    if (!driver) {
      throw new NotFoundException('Sofőr nem található');
    }

    if (!driver.partnerCompanyId) {
      throw new BadRequestException('A sofőr már privát ügyfél (nincs partnere)');
    }

    // Validáció: kötelező számlázási adatok
    if (!billingData.billingName || !billingData.billingAddress ||
        !billingData.billingCity || !billingData.billingZipCode) {
      throw new BadRequestException('Kötelező a számlázási adatok megadása a függetlenné váláshoz');
    }

    const previousPartnerCompanyId = driver.partnerCompanyId;
    const previousPartnerName = driver.partnerCompany?.name;

    // Partner history bejegyzés
    await this.prisma.driverPartnerHistory.create({
      data: {
        networkId: driver.networkId,
        driverId: driver.id,
        fromCompanyId: previousPartnerCompanyId,
        toCompanyId: null,  // NULL = privát ügyfél lett
        reason: 'SELF_DETACH',  // Önkéntes leválás (maga a sofőr kezdeményezte)
      },
    });

    // Sofőr frissítése - privát ügyfél lesz
    const updatedDriver = await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        partnerCompanyId: null,
        isPrivateCustomer: true,
        billingName: billingData.billingName,
        billingAddress: billingData.billingAddress,
        billingCity: billingData.billingCity,
        billingZipCode: billingData.billingZipCode,
        billingCountry: billingData.billingCountry || 'HU',
        billingTaxNumber: billingData.billingTaxNumber,
      },
      include: {
        partnerCompany: true,
      },
    });

    this.logger.log(
      `Driver ${driverId} detached from partner ${previousPartnerName} (${previousPartnerCompanyId}) - now private customer`,
    );

    return updatedDriver;
  }

  /**
   * Privát ügyfél számlázási adatainak frissítése
   */
  async updateBillingInfo(
    driverId: string,
    billingData: {
      billingName?: string;
      billingAddress?: string;
      billingCity?: string;
      billingZipCode?: string;
      billingCountry?: string;
      billingTaxNumber?: string;
    },
  ): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException('Sofőr nem található');
    }

    if (!driver.isPrivateCustomer) {
      throw new BadRequestException('Csak privát ügyfél frissítheti a számlázási adatait');
    }

    return this.prisma.driver.update({
      where: { id: driverId },
      data: {
        billingName: billingData.billingName,
        billingAddress: billingData.billingAddress,
        billingCity: billingData.billingCity,
        billingZipCode: billingData.billingZipCode,
        billingCountry: billingData.billingCountry,
        billingTaxNumber: billingData.billingTaxNumber,
      },
    });
  }
}
