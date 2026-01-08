import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogService } from '../modules/audit-log/audit-log.service';
import { SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  NetworkAdminLoginDto,
  NetworkAdminLoginResponseDto,
  NetworkDashboardDto,
  LocationListItemDto,
  CreateLocationDto,
  UpdateLocationDto,
  PartnerCompanyListItemDto,
  CreatePartnerCompanyDto,
  DriverListItemDto,
  WashEventListItemDto,
  NetworkRegisterDto,
  NetworkRegisterResponseDto,
  TrialStatusDto,
} from './dto/network-admin.dto';

@Injectable()
export class NetworkAdminService {
  private readonly logger = new Logger(NetworkAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // =========================================================================
  // AUTH
  // =========================================================================

  async login(dto: NetworkAdminLoginDto): Promise<NetworkAdminLoginResponseDto> {
    // Find network by slug
    const network = await this.prisma.network.findUnique({
      where: { slug: dto.slug.toLowerCase() },
    });

    if (!network || network.deletedAt || !network.isActive) {
      throw new UnauthorizedException('Hálózat nem található vagy inaktív');
    }

    // Find admin
    const admin = await this.prisma.networkAdmin.findFirst({
      where: {
        networkId: network.id,
        email: dto.email.toLowerCase(),
        deletedAt: null,
      },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Hibás email vagy jelszó');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Hibás email vagy jelszó');
    }

    // Update last login
    await this.prisma.networkAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      networkId: network.id,
      type: 'network',
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET') || 'vsys-network-secret',
      expiresIn: '24h',
    });

    return {
      accessToken,
      adminId: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      networkId: network.id,
      networkName: network.name,
      networkSlug: network.slug,
    };
  }

  async validateToken(token: string): Promise<{
    adminId: string;
    role: string;
    networkId: string;
  } | null> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET') || 'vsys-network-secret',
      });

      if (payload.type !== 'network') {
        return null;
      }

      return {
        adminId: payload.sub,
        role: payload.role,
        networkId: payload.networkId,
      };
    } catch {
      return null;
    }
  }

  // =========================================================================
  // REGISTRATION
  // =========================================================================

  async register(dto: NetworkRegisterDto): Promise<NetworkRegisterResponseDto> {
    // Check if slug is already taken
    const existingNetwork = await this.prisma.network.findUnique({
      where: { slug: dto.slug.toLowerCase() },
    });

    if (existingNetwork) {
      throw new ConflictException('Ez a hálózat azonosító már foglalt');
    }

    // Check if email is already used anywhere
    const existingAdmin = await this.prisma.networkAdmin.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (existingAdmin) {
      throw new ConflictException('Ez az email cím már regisztrálva van');
    }

    // Get platform settings for trial days
    const platformSettings = await this.prisma.platformSettings.findFirst();
    const trialDays = platformSettings?.defaultTrialDays || 14;

    // Calculate trial end date (last day 23:59)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
    trialEndsAt.setHours(23, 59, 59, 999);

    // Create network
    const network = await this.prisma.network.create({
      data: {
        name: dto.networkName,
        slug: dto.slug.toLowerCase(),
        country: dto.country || 'HU',
        timezone: 'Europe/Budapest',
        defaultCurrency: 'HUF',
        defaultLanguage: 'hu',
        subscriptionStatus: SubscriptionStatus.TRIAL,
        trialEndsAt,
      },
    });

    // Create network settings with company info
    await this.prisma.networkSettings.create({
      data: {
        networkId: network.id,
        companyName: dto.networkName,
        companyAddress: dto.companyAddress,
        companyCity: dto.companyCity,
        companyZipCode: dto.companyZipCode,
        companyCountry: dto.country || 'HU',
        taxNumber: dto.taxNumber,
        contactEmail: dto.email,
        contactPhone: dto.phone,
      },
    });

    // Create network branding with defaults
    await this.prisma.networkBranding.create({
      data: { networkId: network.id },
    });

    // Create default HUF currency
    await this.prisma.networkCurrency.create({
      data: {
        networkId: network.id,
        currencyCode: 'HUF',
        currencyName: 'Magyar forint',
        currencySymbol: 'Ft',
        isDefault: true,
      },
    });

    // Create default VAT rate (27%)
    await this.prisma.networkVatRate.create({
      data: {
        networkId: network.id,
        name: 'Általános ÁFA',
        rate: 27,
        code: '27',
        isDefault: true,
      },
    });

    // Hash password and create admin
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const admin = await this.prisma.networkAdmin.create({
      data: {
        networkId: network.id,
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.adminName,
        role: 'NETWORK_OWNER',
        isActive: true,
      },
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        token: verificationToken,
        type: 'EMAIL',
        email: dto.email.toLowerCase(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        networkAdminId: admin.id,
      },
    });

    // Send notification to platform admin (will be implemented with email service)
    await this.notifyPlatformAdminNewRegistration(network, admin, dto);

    this.logger.log(`New network registered: ${network.name} (${network.slug}) by ${admin.email}`);

    return {
      networkId: network.id,
      networkName: network.name,
      networkSlug: network.slug,
      adminId: admin.id,
      email: admin.email,
      trialEndsAt: network.trialEndsAt!,
      message: `Sikeres regisztráció! Kérjük erősítse meg email címét. A próbaidőszak ${trialDays} napig tart.`,
    };
  }

  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const verificationToken = await this.prisma.verificationToken.findFirst({
      where: {
        token,
        type: 'EMAIL',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      throw new BadRequestException('Érvénytelen vagy lejárt token');
    }

    // Mark token as used
    await this.prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });

    // Mark admin email as verified (we could add a field for this)
    if (verificationToken.networkAdminId) {
      await this.prisma.networkAdmin.update({
        where: { id: verificationToken.networkAdminId },
        data: { isActive: true },
      });
    }

    return {
      success: true,
      message: 'Email cím sikeresen megerősítve. Most már bejelentkezhet.',
    };
  }

  async resendVerificationEmail(email: string, slug: string): Promise<{ success: boolean; message: string }> {
    const network = await this.prisma.network.findUnique({
      where: { slug: slug.toLowerCase() },
    });

    if (!network) {
      throw new NotFoundException('Hálózat nem található');
    }

    const admin = await this.prisma.networkAdmin.findFirst({
      where: {
        networkId: network.id,
        email: email.toLowerCase(),
        deletedAt: null,
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin nem található');
    }

    // Invalidate old tokens
    await this.prisma.verificationToken.updateMany({
      where: {
        networkAdminId: admin.id,
        type: 'EMAIL',
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        token: verificationToken,
        type: 'EMAIL',
        email: email.toLowerCase(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        networkAdminId: admin.id,
      },
    });

    // TODO: Send email with verification link

    return {
      success: true,
      message: 'Új megerősítő email elküldve.',
    };
  }

  // =========================================================================
  // TRIAL STATUS
  // =========================================================================

  async getTrialStatus(networkId: string): Promise<TrialStatusDto> {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network) {
      throw new NotFoundException('Network nem található');
    }

    const now = new Date();
    const trialEndsAt = network.trialEndsAt;
    const gracePeriodDays = 5;

    let daysRemaining: number | undefined;
    let minutesRemaining: number | undefined;
    let isExpired = false;
    let isGracePeriod = false;
    let isFullyLocked = false;
    let gracePeriodEndsAt: Date | undefined;

    if (network.subscriptionStatus === SubscriptionStatus.TRIAL && trialEndsAt) {
      const diff = trialEndsAt.getTime() - now.getTime();

      if (diff > 0) {
        // Still in trial
        daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));

        // On the last day, show minutes
        if (daysRemaining <= 1) {
          minutesRemaining = Math.floor(diff / (1000 * 60));
        }
      } else {
        // Trial expired
        isExpired = true;
        const daysSinceExpiry = Math.floor(-diff / (1000 * 60 * 60 * 24));

        if (daysSinceExpiry < gracePeriodDays) {
          // In grace period
          isGracePeriod = true;
          gracePeriodEndsAt = new Date(trialEndsAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
          daysRemaining = gracePeriodDays - daysSinceExpiry;
        } else {
          // Fully locked
          isFullyLocked = true;
        }
      }
    } else if (network.subscriptionStatus === SubscriptionStatus.ACTIVE) {
      // Active subscription
      isExpired = false;
    } else if (network.subscriptionStatus === SubscriptionStatus.SUSPENDED ||
               network.subscriptionStatus === SubscriptionStatus.CANCELLED) {
      isExpired = true;
      isFullyLocked = true;
    }

    return {
      subscriptionStatus: network.subscriptionStatus,
      trialEndsAt: trialEndsAt || undefined,
      daysRemaining,
      minutesRemaining,
      isExpired,
      isGracePeriod,
      gracePeriodEndsAt,
      isFullyLocked,
    };
  }

  private async notifyPlatformAdminNewRegistration(
    network: any,
    admin: any,
    dto: NetworkRegisterDto,
  ): Promise<void> {
    // Get platform settings for contact info
    const platformSettings = await this.prisma.platformSettings.findFirst();

    // Log the registration (email notification will be implemented with email service)
    this.logger.log(`
      [NEW NETWORK REGISTRATION]
      Network: ${network.name} (${network.slug})
      Admin: ${admin.name} <${admin.email}>
      Phone: ${dto.phone}
      Company: ${dto.taxNumber || 'N/A'}
      Trial ends: ${network.trialEndsAt}
    `);

    // TODO: Send email to platform admin
    // await this.emailService.sendPlatformNotification({
    //   to: platformSettings?.supportEmail,
    //   subject: `Új hálózat regisztrált: ${network.name}`,
    //   body: ...
    // });
  }

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  async getDashboard(networkId: string): Promise<NetworkDashboardDto> {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network) {
      throw new NotFoundException('Network nem található');
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalLocations,
      totalDrivers,
      totalPartnerCompanies,
      washEventsToday,
      washEventsThisMonth,
      recentWashEvents,
    ] = await Promise.all([
      this.prisma.location.count({
        where: { networkId, deletedAt: null },
      }),
      this.prisma.driver.count({
        where: { networkId, deletedAt: null },
      }),
      this.prisma.partnerCompany.count({
        where: { networkId, deletedAt: null },
      }),
      this.prisma.washEvent.count({
        where: { networkId, createdAt: { gte: startOfDay } },
      }),
      this.prisma.washEvent.count({
        where: { networkId, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.washEvent.findMany({
        where: { networkId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          driver: true,
          location: true,
          tractorVehicle: true,
        },
      }),
    ]);

    // Calculate revenue (simplified)
    const washEventsForRevenue = await this.prisma.washEvent.findMany({
      where: { networkId, createdAt: { gte: startOfMonth } },
      select: { totalPrice: true },
    });
    const revenueThisMonth = washEventsForRevenue.reduce(
      (sum, e) => sum + Number(e.totalPrice || 0),
      0,
    );

    return {
      networkName: network.name,
      subscriptionStatus: network.subscriptionStatus,
      trialEndsAt: network.trialEndsAt || undefined,
      totalLocations,
      totalDrivers,
      totalPartnerCompanies,
      washEventsToday,
      washEventsThisMonth,
      revenueThisMonth,
      recentWashEvents: recentWashEvents.map((e: any) => ({
        id: e.id,
        licensePlate: e.tractorVehicle?.licensePlate || e.tractorPlateManual || 'N/A',
        driverName: e.driver ? `${e.driver.lastName} ${e.driver.firstName}` : (e.driverNameManual || 'N/A'),
        locationName: e.location?.name || 'N/A',
        totalPrice: Number(e.totalPrice || 0),
        createdAt: e.createdAt,
      })),
    };
  }

  // =========================================================================
  // LOCATIONS
  // =========================================================================

  async listLocations(networkId: string): Promise<LocationListItemDto[]> {
    const locations = await this.prisma.location.findMany({
      where: { networkId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            washEvents: true,
          },
        },
      },
    });

    return locations.map((l: any) => ({
      id: l.id,
      name: l.name,
      address: l.address || '',
      city: l.city || '',
      isActive: l.isActive,
      operatorCount: 0, // operators reláció nem létezik
      washEventCount: l._count?.washEvents || 0,
    }));
  }

  async createLocation(networkId: string, dto: CreateLocationDto): Promise<LocationListItemDto> {
    // Generate a code from the name or use provided code
    const code = dto.code || dto.name.substring(0, 8).toUpperCase().replace(/\s+/g, '');

    const location = await this.prisma.location.create({
      data: {
        networkId,
        name: dto.name,
        code,
        address: dto.address,
        city: dto.city,
        zipCode: dto.postalCode,
        country: dto.country || 'HU',
        timezone: dto.timezone || 'Europe/Budapest',
        latitude: dto.latitude,
        longitude: dto.longitude,
        openingHours: dto.openingHours,
        phone: dto.phone,
        email: dto.email,
      },
      include: {
        _count: {
          select: {
            washEvents: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'CREATE',
      actorType: 'USER',
      newData: { type: 'LOCATION', id: location.id, name: location.name, code },
      metadata: { entityType: 'location' },
    });

    return {
      id: location.id,
      name: location.name,
      address: location.address || '',
      city: location.city || '',
      isActive: location.isActive,
      operatorCount: 0,
      washEventCount: (location as any)._count?.washEvents || 0,
    };
  }

  async updateLocation(
    networkId: string,
    locationId: string,
    dto: UpdateLocationDto,
  ): Promise<LocationListItemDto> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, networkId, deletedAt: null },
    });

    if (!location) {
      throw new NotFoundException('Helyszín nem található');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.code !== undefined) updateData.code = dto.code;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.postalCode !== undefined) updateData.zipCode = dto.postalCode;
    if (dto.country !== undefined) updateData.country = dto.country;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
    if (dto.latitude !== undefined) updateData.latitude = dto.latitude;
    if (dto.longitude !== undefined) updateData.longitude = dto.longitude;
    if (dto.openingHours !== undefined) updateData.openingHours = dto.openingHours;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;

    const updated = await this.prisma.location.update({
      where: { id: locationId },
      data: updateData,
      include: {
        _count: {
          select: {
            washEvents: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      previousData: { type: 'LOCATION', id: location.id, name: location.name },
      newData: { type: 'LOCATION', id: updated.id, name: updated.name, ...updateData },
      metadata: { entityType: 'location' },
    });

    return {
      id: updated.id,
      name: updated.name,
      address: updated.address || '',
      city: updated.city || '',
      isActive: updated.isActive,
      operatorCount: 0,
      washEventCount: (updated as any)._count?.washEvents || 0,
    };
  }

  async deleteLocation(networkId: string, locationId: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, networkId, deletedAt: null },
    });

    if (!location) {
      throw new NotFoundException('Helyszín nem található');
    }

    await this.prisma.location.update({
      where: { id: locationId },
      data: { deletedAt: new Date(), isActive: false },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      previousData: { type: 'LOCATION', id: location.id, name: location.name, isActive: true },
      newData: { type: 'LOCATION', id: location.id, name: location.name, deleted: true },
      metadata: { entityType: 'location', operation: 'delete' },
    });
  }

  // =========================================================================
  // PARTNER COMPANIES
  // =========================================================================

  async listPartnerCompanies(networkId: string): Promise<PartnerCompanyListItemDto[]> {
    const companies = await this.prisma.partnerCompany.findMany({
      where: { networkId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            drivers: { where: { deletedAt: null } },
            vehicles: { where: { deletedAt: null } },
          },
        },
      },
    });

    return companies.map((c: any) => ({
      id: c.id,
      name: c.name,
      taxNumber: c.taxNumber || '',
      isActive: c.isActive,
      driverCount: c._count?.drivers || 0,
      vehicleCount: c._count?.vehicles || 0,
    }));
  }

  async createPartnerCompany(
    networkId: string,
    dto: CreatePartnerCompanyDto,
  ): Promise<PartnerCompanyListItemDto> {
    const code = dto.name.substring(0, 10).toUpperCase().replace(/\s+/g, '');
    const company = await this.prisma.partnerCompany.create({
      data: {
        networkId,
        name: dto.name,
        code,
        taxNumber: dto.taxNumber,
        billingAddress: dto.billingAddress,
        email: dto.contactEmail,
        phone: dto.contactPhone,
      },
      include: {
        _count: {
          select: {
            drivers: { where: { deletedAt: null } },
            vehicles: { where: { deletedAt: null } },
          },
        },
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'CREATE',
      actorType: 'USER',
      newData: { type: 'PARTNER_COMPANY', id: company.id, name: company.name, code },
      metadata: { entityType: 'partner_company' },
    });

    return {
      id: company.id,
      name: company.name,
      taxNumber: company.taxNumber || '',
      isActive: company.isActive,
      driverCount: (company as any)._count?.drivers || 0,
      vehicleCount: (company as any)._count?.vehicles || 0,
    };
  }

  // =========================================================================
  // DRIVERS
  // =========================================================================

  async listDrivers(networkId: string): Promise<DriverListItemDto[]> {
    const drivers = await this.prisma.driver.findMany({
      where: { networkId, deletedAt: null },
      orderBy: { lastName: 'asc' },
      include: {
        partnerCompany: true,
        _count: {
          select: {
            vehicles: { where: { deletedAt: null } },
            washEvents: true,
          },
        },
      },
    });

    return drivers.map((d: any) => ({
      id: d.id,
      name: `${d.lastName} ${d.firstName}`,
      phone: d.phone || '',
      email: d.email || undefined,
      partnerCompanyName: d.partnerCompany?.name,
      isActive: d.isActive,
      vehicleCount: d._count?.vehicles || 0,
      washEventCount: d._count?.washEvents || 0,
    }));
  }

  // =========================================================================
  // WASH EVENTS
  // =========================================================================

  async listWashEvents(
    networkId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<WashEventListItemDto[]> {
    const { limit = 50, offset = 0 } = options;

    const events = await this.prisma.washEvent.findMany({
      where: { networkId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        driver: true,
        location: true,
        tractorVehicle: true,
        services: {
          include: { servicePackage: true },
        },
      },
    });

    return events.map((e: any) => ({
      id: e.id,
      licensePlate: e.tractorVehicle?.licensePlate || e.tractorPlateManual || 'N/A',
      vehicleType: e.tractorVehicle?.vehicleType || 'N/A',
      driverName: e.driver?.name || e.driverNameManual || 'N/A',
      locationName: e.location?.name || 'N/A',
      services: (e.services || []).map((s: any) => s.servicePackage?.name || 'N/A'),
      totalPrice: Number(e.totalPrice || 0),
      currency: 'HUF', // Default currency
      createdAt: e.createdAt,
    }));
  }

  // =========================================================================
  // SERVICE PACKAGES
  // =========================================================================

  async listServicePackages(networkId: string): Promise<any[]> {
    const packages = await this.prisma.servicePackage.findMany({
      where: { networkId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    return packages.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      isActive: p.isActive,
    }));
  }

  async createServicePackage(
    networkId: string,
    dto: { name: string; code: string; description?: string },
  ): Promise<any> {
    // Check if code is unique within the network
    const existing = await this.prisma.servicePackage.findFirst({
      where: { networkId, code: dto.code, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException('Ez a szolgáltatás kód már létezik');
    }

    const pkg = await this.prisma.servicePackage.create({
      data: {
        networkId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'CREATE',
      actorType: 'USER',
      newData: { type: 'SERVICE_PACKAGE', id: pkg.id, name: pkg.name, code: pkg.code },
      metadata: { entityType: 'service_package' },
    });

    return {
      id: pkg.id,
      name: pkg.name,
      code: pkg.code,
      description: pkg.description,
      isActive: pkg.isActive,
    };
  }

  async updateServicePackage(
    networkId: string,
    packageId: string,
    dto: { name?: string; code?: string; description?: string; isActive?: boolean },
  ): Promise<any> {
    const pkg = await this.prisma.servicePackage.findFirst({
      where: { id: packageId, networkId, deletedAt: null },
    });

    if (!pkg) {
      throw new NotFoundException('Szolgáltatás csomag nem található');
    }

    // Check unique code if changing
    if (dto.code && dto.code !== pkg.code) {
      const existing = await this.prisma.servicePackage.findFirst({
        where: { networkId, code: dto.code, deletedAt: null, id: { not: packageId } },
      });
      if (existing) {
        throw new ConflictException('Ez a szolgáltatás kód már létezik');
      }
    }

    const updated = await this.prisma.servicePackage.update({
      where: { id: packageId },
      data: {
        name: dto.name,
        code: dto.code?.toUpperCase(),
        description: dto.description,
        isActive: dto.isActive,
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      previousData: { type: 'SERVICE_PACKAGE', id: pkg.id, name: pkg.name, code: pkg.code },
      newData: { type: 'SERVICE_PACKAGE', id: updated.id, name: updated.name, code: updated.code },
      metadata: { entityType: 'service_package' },
    });

    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      description: updated.description,
      isActive: updated.isActive,
    };
  }

  async deleteServicePackage(networkId: string, packageId: string): Promise<void> {
    const pkg = await this.prisma.servicePackage.findFirst({
      where: { id: packageId, networkId, deletedAt: null },
    });

    if (!pkg) {
      throw new NotFoundException('Szolgáltatás csomag nem található');
    }

    await this.prisma.servicePackage.update({
      where: { id: packageId },
      data: { deletedAt: new Date(), isActive: false },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      previousData: { type: 'SERVICE_PACKAGE', id: pkg.id, name: pkg.name, isActive: true },
      newData: { type: 'SERVICE_PACKAGE', id: pkg.id, name: pkg.name, deleted: true },
      metadata: { entityType: 'service_package', operation: 'delete' },
    });
  }

  // =========================================================================
  // PRICES
  // =========================================================================

  async listPrices(networkId: string): Promise<any[]> {
    const prices = await this.prisma.servicePrice.findMany({
      where: { networkId, isActive: true },
      orderBy: [{ servicePackageId: 'asc' }, { vehicleType: 'asc' }],
      include: {
        servicePackage: true,
      },
    });

    return prices.map((p) => ({
      id: p.id,
      servicePackageId: p.servicePackageId,
      vehicleType: p.vehicleType,
      price: Number(p.price),
      currency: p.currency,
      isActive: p.isActive,
      servicePackage: p.servicePackage
        ? {
            id: p.servicePackage.id,
            name: p.servicePackage.name,
            code: p.servicePackage.code,
          }
        : null,
    }));
  }

  async createPrice(
    networkId: string,
    dto: { servicePackageId: string; vehicleType: string; price: number },
  ): Promise<any> {
    // Verify service package belongs to this network
    const pkg = await this.prisma.servicePackage.findFirst({
      where: { id: dto.servicePackageId, networkId, deletedAt: null },
    });

    if (!pkg) {
      throw new NotFoundException('Szolgáltatás csomag nem található');
    }

    // Check if price already exists for this combination
    const existing = await this.prisma.servicePrice.findFirst({
      where: {
        networkId,
        servicePackageId: dto.servicePackageId,
        vehicleType: dto.vehicleType as any,
      },
    });

    if (existing) {
      throw new ConflictException('Ez az ár kombináció már létezik');
    }

    const price = await this.prisma.servicePrice.create({
      data: {
        networkId,
        servicePackageId: dto.servicePackageId,
        vehicleType: dto.vehicleType as any,
        price: dto.price,
        currency: 'HUF',
      },
      include: {
        servicePackage: true,
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'CREATE',
      actorType: 'USER',
      newData: { type: 'PRICE', id: price.id, servicePackage: pkg.name, vehicleType: dto.vehicleType, price: dto.price },
      metadata: { entityType: 'price' },
    });

    return {
      id: price.id,
      servicePackageId: price.servicePackageId,
      vehicleType: price.vehicleType,
      price: Number(price.price),
      currency: price.currency,
      isActive: price.isActive,
    };
  }

  async updatePrice(
    networkId: string,
    priceId: string,
    dto: { servicePackageId?: string; vehicleType?: string; price?: number },
  ): Promise<any> {
    const priceRecord = await this.prisma.servicePrice.findFirst({
      where: { id: priceId, networkId },
    });

    if (!priceRecord) {
      throw new NotFoundException('Ár nem található');
    }

    // If changing service package, verify it belongs to this network
    if (dto.servicePackageId) {
      const pkg = await this.prisma.servicePackage.findFirst({
        where: { id: dto.servicePackageId, networkId, deletedAt: null },
      });
      if (!pkg) {
        throw new NotFoundException('Szolgáltatás csomag nem található');
      }
    }

    const updated = await this.prisma.servicePrice.update({
      where: { id: priceId },
      data: {
        servicePackageId: dto.servicePackageId,
        vehicleType: dto.vehicleType as any,
        price: dto.price,
      },
      include: {
        servicePackage: true,
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      previousData: { type: 'PRICE', id: priceRecord.id, vehicleType: priceRecord.vehicleType, price: Number(priceRecord.price) },
      newData: { type: 'PRICE', id: updated.id, vehicleType: updated.vehicleType, price: Number(updated.price) },
      metadata: { entityType: 'price' },
    });

    return {
      id: updated.id,
      servicePackageId: updated.servicePackageId,
      vehicleType: updated.vehicleType,
      price: Number(updated.price),
      currency: updated.currency,
      isActive: updated.isActive,
    };
  }

  async deletePrice(networkId: string, priceId: string): Promise<void> {
    const priceRecord = await this.prisma.servicePrice.findFirst({
      where: { id: priceId, networkId },
    });

    if (!priceRecord) {
      throw new NotFoundException('Ár nem található');
    }

    await this.prisma.servicePrice.update({
      where: { id: priceId },
      data: { isActive: false },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      previousData: { type: 'PRICE', id: priceRecord.id, vehicleType: priceRecord.vehicleType, price: Number(priceRecord.price), isActive: true },
      newData: { type: 'PRICE', id: priceRecord.id, vehicleType: priceRecord.vehicleType, deleted: true },
      metadata: { entityType: 'price', operation: 'delete' },
    });
  }

  // =========================================================================
  // SETTINGS
  // =========================================================================

  async getSettings(networkId: string): Promise<any> {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
      include: {
        settings: true,
      },
    });

    if (!network) {
      throw new NotFoundException('Network nem található');
    }

    const settings = network.settings;

    return {
      // Network alapadatok
      network: {
        id: network.id,
        name: network.name,
        slug: network.slug,
        country: network.country,
        timezone: network.timezone,
        defaultCurrency: network.defaultCurrency,
        defaultLanguage: network.defaultLanguage,
      },
      // Cégadatok
      company: {
        companyName: settings?.companyName || '',
        companyAddress: settings?.companyAddress || '',
        companyCity: settings?.companyCity || '',
        companyZipCode: settings?.companyZipCode || '',
        companyCountry: settings?.companyCountry || network.country,
        taxNumber: settings?.taxNumber || '',
        euVatNumber: settings?.euVatNumber || '',
        bankAccountNumber: settings?.bankAccountNumber || '',
        bankAccountIban: settings?.bankAccountIban || '',
        bankName: settings?.bankName || '',
      },
      // Kapcsolattartó
      contact: {
        contactEmail: settings?.contactEmail || '',
        contactPhone: settings?.contactPhone || '',
      },
      // Számlázási integráció
      invoicing: {
        invoiceProvider: settings?.invoiceProvider || 'NONE',
        szamlazzAgentKey: settings?.szamlazzAgentKey ? '***' : '',
        billingoApiKey: settings?.billingoApiKey ? '***' : '',
        billingoBlockId: settings?.billingoBlockId || null,
        navOnlineUser: settings?.navOnlineUser || '',
        navOnlineTaxNum: settings?.navOnlineTaxNum || '',
        // Nem küldjük vissza a jelszavakat
      },
      // Email beállítások
      email: {
        emailProvider: settings?.emailProvider || 'PLATFORM',
        smtpHost: settings?.smtpHost || '',
        smtpPort: settings?.smtpPort || null,
        smtpUser: settings?.smtpUser || '',
        smtpFromEmail: settings?.smtpFromEmail || '',
        smtpFromName: settings?.smtpFromName || '',
        resendApiKey: settings?.resendApiKey ? '***' : '',
      },
      // SMS beállítások
      sms: {
        smsProvider: settings?.smsProvider || 'PLATFORM',
        twilioPhoneNumber: settings?.twilioPhoneNumber || '',
        twilioAccountSid: settings?.twilioAccountSid ? '***' : '',
      },
      // Üzleti szabályok
      business: {
        allowCashPayment: settings?.allowCashPayment ?? true,
        allowCardPayment: settings?.allowCardPayment ?? true,
        allowFuelCards: settings?.allowFuelCards ?? true,
        autoApproveDrivers: settings?.autoApproveDrivers ?? false,
        requireEmailVerify: settings?.requireEmailVerify ?? true,
        requirePhoneVerify: settings?.requirePhoneVerify ?? false,
        allowSelfRegistration: settings?.allowSelfRegistration ?? true,
      },
    };
  }

  async updateSettings(networkId: string, dto: any): Promise<any> {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
      include: { settings: true },
    });

    if (!network) {
      throw new NotFoundException('Network nem található');
    }

    // Network alapadatok frissítése
    if (dto.network) {
      await this.prisma.network.update({
        where: { id: networkId },
        data: {
          name: dto.network.name,
          country: dto.network.country,
          timezone: dto.network.timezone,
          defaultCurrency: dto.network.defaultCurrency,
          defaultLanguage: dto.network.defaultLanguage,
        },
      });
    }

    // Settings adatok összeállítása
    const settingsData: any = {};

    // Cégadatok
    if (dto.company) {
      Object.assign(settingsData, {
        companyName: dto.company.companyName,
        companyAddress: dto.company.companyAddress,
        companyCity: dto.company.companyCity,
        companyZipCode: dto.company.companyZipCode,
        companyCountry: dto.company.companyCountry,
        taxNumber: dto.company.taxNumber,
        euVatNumber: dto.company.euVatNumber,
        bankAccountNumber: dto.company.bankAccountNumber,
        bankAccountIban: dto.company.bankAccountIban,
        bankName: dto.company.bankName,
      });
    }

    // Kapcsolattartó
    if (dto.contact) {
      Object.assign(settingsData, {
        contactEmail: dto.contact.contactEmail,
        contactPhone: dto.contact.contactPhone,
      });
    }

    // Számlázási integráció
    if (dto.invoicing) {
      Object.assign(settingsData, {
        invoiceProvider: dto.invoicing.invoiceProvider,
      });
      // Csak nem maszkolt értékeket frissítünk
      if (dto.invoicing.szamlazzAgentKey && dto.invoicing.szamlazzAgentKey !== '***') {
        settingsData.szamlazzAgentKey = dto.invoicing.szamlazzAgentKey;
      }
      if (dto.invoicing.billingoApiKey && dto.invoicing.billingoApiKey !== '***') {
        settingsData.billingoApiKey = dto.invoicing.billingoApiKey;
      }
      if (dto.invoicing.billingoBlockId !== undefined) {
        settingsData.billingoBlockId = dto.invoicing.billingoBlockId;
      }
      if (dto.invoicing.navOnlineUser) {
        settingsData.navOnlineUser = dto.invoicing.navOnlineUser;
      }
      if (dto.invoicing.navOnlinePassword && dto.invoicing.navOnlinePassword !== '***') {
        settingsData.navOnlinePassword = dto.invoicing.navOnlinePassword;
      }
      if (dto.invoicing.navOnlineTaxNum) {
        settingsData.navOnlineTaxNum = dto.invoicing.navOnlineTaxNum;
      }
      if (dto.invoicing.navOnlineSignKey && dto.invoicing.navOnlineSignKey !== '***') {
        settingsData.navOnlineSignKey = dto.invoicing.navOnlineSignKey;
      }
      if (dto.invoicing.navOnlineExchKey && dto.invoicing.navOnlineExchKey !== '***') {
        settingsData.navOnlineExchKey = dto.invoicing.navOnlineExchKey;
      }
    }

    // Email beállítások
    if (dto.email) {
      Object.assign(settingsData, {
        emailProvider: dto.email.emailProvider,
        smtpHost: dto.email.smtpHost,
        smtpPort: dto.email.smtpPort,
        smtpUser: dto.email.smtpUser,
        smtpFromEmail: dto.email.smtpFromEmail,
        smtpFromName: dto.email.smtpFromName,
      });
      if (dto.email.smtpPassword && dto.email.smtpPassword !== '***') {
        settingsData.smtpPassword = dto.email.smtpPassword;
      }
      if (dto.email.resendApiKey && dto.email.resendApiKey !== '***') {
        settingsData.resendApiKey = dto.email.resendApiKey;
      }
    }

    // SMS beállítások
    if (dto.sms) {
      Object.assign(settingsData, {
        smsProvider: dto.sms.smsProvider,
        twilioPhoneNumber: dto.sms.twilioPhoneNumber,
      });
      if (dto.sms.twilioAccountSid && dto.sms.twilioAccountSid !== '***') {
        settingsData.twilioAccountSid = dto.sms.twilioAccountSid;
      }
      if (dto.sms.twilioAuthToken && dto.sms.twilioAuthToken !== '***') {
        settingsData.twilioAuthToken = dto.sms.twilioAuthToken;
      }
    }

    // Üzleti szabályok
    if (dto.business) {
      Object.assign(settingsData, {
        allowCashPayment: dto.business.allowCashPayment,
        allowCardPayment: dto.business.allowCardPayment,
        allowFuelCards: dto.business.allowFuelCards,
        autoApproveDrivers: dto.business.autoApproveDrivers,
        requireEmailVerify: dto.business.requireEmailVerify,
        requirePhoneVerify: dto.business.requirePhoneVerify,
        allowSelfRegistration: dto.business.allowSelfRegistration,
      });
    }

    // Settings létrehozása vagy frissítése
    if (network.settings) {
      await this.prisma.networkSettings.update({
        where: { id: network.settings.id },
        data: settingsData,
      });
    } else {
      await this.prisma.networkSettings.create({
        data: {
          networkId,
          ...settingsData,
        },
      });
    }

    return this.getSettings(networkId);
  }

  // =========================================================================
  // VAT RATES
  // =========================================================================

  async listVatRates(networkId: string): Promise<any[]> {
    const vatRates = await this.prisma.networkVatRate.findMany({
      where: { networkId, isActive: true },
      orderBy: { rate: 'desc' },
    });

    return vatRates.map((v) => ({
      id: v.id,
      name: v.name,
      rate: v.rate,
      code: v.code,
      isDefault: v.isDefault,
      isActive: v.isActive,
    }));
  }

  async createVatRate(
    networkId: string,
    dto: { name: string; rate: number; code?: string; isDefault?: boolean },
  ): Promise<any> {
    // Ha ez lesz az alapértelmezett, töröljük a többiről
    if (dto.isDefault) {
      await this.prisma.networkVatRate.updateMany({
        where: { networkId },
        data: { isDefault: false },
      });
    }

    const vatRate = await this.prisma.networkVatRate.create({
      data: {
        networkId,
        name: dto.name,
        rate: dto.rate,
        code: dto.code,
        isDefault: dto.isDefault ?? false,
      },
    });

    return {
      id: vatRate.id,
      name: vatRate.name,
      rate: vatRate.rate,
      code: vatRate.code,
      isDefault: vatRate.isDefault,
      isActive: vatRate.isActive,
    };
  }

  async updateVatRate(
    networkId: string,
    vatRateId: string,
    dto: { name?: string; rate?: number; code?: string; isDefault?: boolean; isActive?: boolean },
  ): Promise<any> {
    const vatRate = await this.prisma.networkVatRate.findFirst({
      where: { id: vatRateId, networkId },
    });

    if (!vatRate) {
      throw new NotFoundException('ÁFA kulcs nem található');
    }

    // Ha ez lesz az alapértelmezett, töröljük a többiről
    if (dto.isDefault) {
      await this.prisma.networkVatRate.updateMany({
        where: { networkId, id: { not: vatRateId } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.networkVatRate.update({
      where: { id: vatRateId },
      data: {
        name: dto.name,
        rate: dto.rate,
        code: dto.code,
        isDefault: dto.isDefault,
        isActive: dto.isActive,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      rate: updated.rate,
      code: updated.code,
      isDefault: updated.isDefault,
      isActive: updated.isActive,
    };
  }

  async deleteVatRate(networkId: string, vatRateId: string): Promise<void> {
    const vatRate = await this.prisma.networkVatRate.findFirst({
      where: { id: vatRateId, networkId },
    });

    if (!vatRate) {
      throw new NotFoundException('ÁFA kulcs nem található');
    }

    await this.prisma.networkVatRate.update({
      where: { id: vatRateId },
      data: { isActive: false },
    });
  }

  // =========================================================================
  // CURRENCIES
  // =========================================================================

  async listCurrencies(networkId: string): Promise<any[]> {
    const currencies = await this.prisma.networkCurrency.findMany({
      where: { networkId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { currencyCode: 'asc' }],
    });

    return currencies.map((c) => ({
      id: c.id,
      currencyCode: c.currencyCode,
      currencyName: c.currencyName,
      currencySymbol: c.currencySymbol,
      isDefault: c.isDefault,
      isAccepted: c.isAccepted,
      exchangeRateSource: c.exchangeRateSource,
      fixedExchangeRate: c.fixedExchangeRate ? Number(c.fixedExchangeRate) : null,
      exchangeRateMargin: c.exchangeRateMargin,
      lastExchangeRate: c.lastExchangeRate ? Number(c.lastExchangeRate) : null,
      rateUpdatedAt: c.rateUpdatedAt,
    }));
  }

  async addCurrency(
    networkId: string,
    dto: { currencyCode: string; currencyName?: string; currencySymbol?: string; isDefault?: boolean },
  ): Promise<any> {
    // Ellenőrizzük, hogy létezik-e már
    const existing = await this.prisma.networkCurrency.findFirst({
      where: { networkId, currencyCode: dto.currencyCode },
    });

    if (existing) {
      throw new ConflictException('Ez a pénznem már létezik');
    }

    // Ha ez lesz az alapértelmezett, töröljük a többiről
    if (dto.isDefault) {
      await this.prisma.networkCurrency.updateMany({
        where: { networkId },
        data: { isDefault: false },
      });
    }

    const currency = await this.prisma.networkCurrency.create({
      data: {
        networkId,
        currencyCode: dto.currencyCode.toUpperCase(),
        currencyName: dto.currencyName,
        currencySymbol: dto.currencySymbol,
        isDefault: dto.isDefault ?? false,
      },
    });

    return {
      id: currency.id,
      currencyCode: currency.currencyCode,
      currencyName: currency.currencyName,
      currencySymbol: currency.currencySymbol,
      isDefault: currency.isDefault,
      isAccepted: currency.isAccepted,
    };
  }

  async updateCurrency(
    networkId: string,
    currencyId: string,
    dto: { currencyName?: string; currencySymbol?: string; isDefault?: boolean; isActive?: boolean },
  ): Promise<any> {
    const currency = await this.prisma.networkCurrency.findFirst({
      where: { id: currencyId, networkId },
    });

    if (!currency) {
      throw new NotFoundException('Pénznem nem található');
    }

    // Ha ez lesz az alapértelmezett, töröljük a többiről
    if (dto.isDefault) {
      await this.prisma.networkCurrency.updateMany({
        where: { networkId, id: { not: currencyId } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.networkCurrency.update({
      where: { id: currencyId },
      data: {
        currencyName: dto.currencyName,
        currencySymbol: dto.currencySymbol,
        isDefault: dto.isDefault,
        isActive: dto.isActive,
      },
    });

    return {
      id: updated.id,
      currencyCode: updated.currencyCode,
      currencyName: updated.currencyName,
      currencySymbol: updated.currencySymbol,
      isDefault: updated.isDefault,
      isAccepted: updated.isAccepted,
    };
  }

  async removeCurrency(networkId: string, currencyId: string): Promise<void> {
    const currency = await this.prisma.networkCurrency.findFirst({
      where: { id: currencyId, networkId },
    });

    if (!currency) {
      throw new NotFoundException('Pénznem nem található');
    }

    if (currency.isDefault) {
      throw new ConflictException('Az alapértelmezett pénznem nem törölhető');
    }

    await this.prisma.networkCurrency.update({
      where: { id: currencyId },
      data: { isActive: false },
    });
  }

  // =========================================================================
  // LOCATION OPERATORS
  // =========================================================================

  async listLocationOperators(networkId: string, locationId: string): Promise<any[]> {
    // Verify location belongs to this network
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, networkId, deletedAt: null },
    });

    if (!location) {
      throw new NotFoundException('Helyszín nem található');
    }

    const operators = await this.prisma.locationOperator.findMany({
      where: { locationId, networkId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    return operators.map((o) => ({
      id: o.id,
      locationId: o.locationId,
      name: o.name,
      isActive: o.isActive,
      createdAt: o.createdAt,
    }));
  }

  async createLocationOperator(
    networkId: string,
    locationId: string,
    dto: { name: string; pin: string },
  ): Promise<any> {
    // Verify location belongs to this network
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, networkId, deletedAt: null },
    });

    if (!location) {
      throw new NotFoundException('Helyszín nem található');
    }

    if (!dto.pin || dto.pin.length < 4) {
      throw new ConflictException('A PIN kódnak legalább 4 karakter hosszúnak kell lennie');
    }

    const bcrypt = await import('bcrypt');
    const pinHash = await bcrypt.hash(dto.pin, 10);

    const operator = await this.prisma.locationOperator.create({
      data: {
        networkId,
        locationId,
        name: dto.name,
        pinHash,
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'CREATE',
      actorType: 'USER',
      newData: { type: 'OPERATOR', id: operator.id, name: operator.name, locationId, locationName: location.name },
      metadata: { entityType: 'operator' },
    });

    return {
      id: operator.id,
      locationId: operator.locationId,
      name: operator.name,
      isActive: operator.isActive,
      createdAt: operator.createdAt,
    };
  }

  async updateOperator(
    networkId: string,
    operatorId: string,
    dto: { name?: string; pin?: string; isActive?: boolean },
  ): Promise<any> {
    const operator = await this.prisma.locationOperator.findFirst({
      where: { id: operatorId, networkId, deletedAt: null },
    });

    if (!operator) {
      throw new NotFoundException('Operátor nem található');
    }

    const updateData: any = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (dto.pin) {
      if (dto.pin.length < 4) {
        throw new ConflictException('A PIN kódnak legalább 4 karakter hosszúnak kell lennie');
      }
      const bcrypt = await import('bcrypt');
      updateData.pinHash = await bcrypt.hash(dto.pin, 10);
    }

    const updated = await this.prisma.locationOperator.update({
      where: { id: operatorId },
      data: updateData,
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      previousData: { type: 'OPERATOR', id: operator.id, name: operator.name },
      newData: { type: 'OPERATOR', id: updated.id, name: updated.name, ...updateData },
      metadata: { entityType: 'operator' },
    });

    return {
      id: updated.id,
      locationId: updated.locationId,
      name: updated.name,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }

  async deleteOperator(networkId: string, operatorId: string): Promise<void> {
    const operator = await this.prisma.locationOperator.findFirst({
      where: { id: operatorId, networkId, deletedAt: null },
    });

    if (!operator) {
      throw new NotFoundException('Operátor nem található');
    }

    await this.prisma.locationOperator.update({
      where: { id: operatorId },
      data: { deletedAt: new Date(), isActive: false },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      previousData: { type: 'OPERATOR', id: operator.id, name: operator.name, isActive: true },
      newData: { type: 'OPERATOR', id: operator.id, name: operator.name, deleted: true },
      metadata: { entityType: 'operator', operation: 'delete' },
    });
  }

  // =========================================================================
  // WASH DELETE REQUESTS
  // =========================================================================

  async listDeleteRequests(networkId: string, status: string): Promise<any[]> {
    const requests = await this.prisma.washDeleteRequest.findMany({
      where: { networkId, status },
      orderBy: { createdAt: 'desc' },
      include: {
        washEvent: {
          include: {
            location: true,
            partnerCompany: true,
            driver: true,
          },
        },
      },
    });

    return requests.map((r) => ({
      id: r.id,
      washEventId: r.washEventId,
      requestedBy: r.requestedBy,
      reason: r.reason,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt,
      washEvent: r.washEvent ? {
        id: r.washEvent.id,
        locationName: r.washEvent.location?.name || 'N/A',
        partnerCompanyName: r.washEvent.partnerCompany?.name || 'N/A',
        driverName: r.washEvent.driver
          ? `${r.washEvent.driver.lastName} ${r.washEvent.driver.firstName}`
          : (r.washEvent.driverNameManual || 'N/A'),
        tractorPlate: r.washEvent.tractorPlateManual || 'N/A',
        totalPrice: Number(r.washEvent.totalPrice || 0),
        createdAt: r.washEvent.createdAt,
        status: r.washEvent.status,
      } : null,
    }));
  }

  async approveDeleteRequest(
    networkId: string,
    requestId: string,
    adminId: string,
    note?: string,
  ): Promise<any> {
    const request = await this.prisma.washDeleteRequest.findFirst({
      where: { id: requestId, networkId, status: 'PENDING' },
      include: { washEvent: true },
    });

    if (!request) {
      throw new NotFoundException('Törlési kérelem nem található vagy már feldolgozott');
    }

    // Update the request
    const updated = await this.prisma.washDeleteRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });

    // Soft delete the wash event
    await this.prisma.washEvent.update({
      where: { id: request.washEventId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: `Törlési kérelem jóváhagyva: ${request.reason}`,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        networkId,
        washEventId: request.washEventId,
        action: 'REJECT',
        actorType: 'USER',
        actorId: `network-admin:${adminId}`,
        newData: {
          deleteRequest: {
            id: requestId,
            status: 'APPROVED',
            reason: request.reason,
            adminNote: note,
          },
        },
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      reviewedAt: updated.reviewedAt,
      message: 'Törlési kérelem jóváhagyva, mosás törölve',
    };
  }

  async rejectDeleteRequest(
    networkId: string,
    requestId: string,
    adminId: string,
    note?: string,
  ): Promise<any> {
    const request = await this.prisma.washDeleteRequest.findFirst({
      where: { id: requestId, networkId, status: 'PENDING' },
    });

    if (!request) {
      throw new NotFoundException('Törlési kérelem nem található vagy már feldolgozott');
    }

    const updated = await this.prisma.washDeleteRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        networkId,
        washEventId: request.washEventId,
        action: 'UPDATE',
        actorType: 'USER',
        actorId: `network-admin:${adminId}`,
        newData: {
          deleteRequest: {
            id: requestId,
            status: 'REJECTED',
            reason: request.reason,
            adminNote: note,
          },
        },
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      reviewedAt: updated.reviewedAt,
      message: 'Törlési kérelem elutasítva',
    };
  }

  // ==========================================================================
  // AUDIT LOGS
  // ==========================================================================

  async getAuditLogs(
    networkId: string,
    options: {
      action?: string;
      actorType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: any[]; total: number }> {
    const where: any = {
      networkId,
    };

    if (options.action) {
      where.action = options.action;
    }

    if (options.actorType) {
      where.actorType = options.actorType;
    }

    if (options.startDate || options.endDate) {
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
              tractorPlateManual: true,
              trailerPlateManual: true,
              location: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: options.limit || 100,
        skip: options.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: data.map((log) => ({
        id: log.id,
        action: log.action,
        actorType: log.actorType,
        actorId: log.actorId,
        createdAt: log.createdAt,
        previousData: log.previousData,
        newData: log.newData,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        washEvent: log.washEvent,
      })),
      total,
    };
  }

  async getWashEventAuditLogs(
    networkId: string,
    washEventId: string,
  ): Promise<any[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        networkId,
        washEventId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      actorType: log.actorType,
      actorId: log.actorId,
      createdAt: log.createdAt,
      previousData: log.previousData,
      newData: log.newData,
      metadata: log.metadata,
    }));
  }

  // =========================================================================
  // LOCATION SERVICES (Service Availability)
  // =========================================================================

  async listLocationServices(networkId: string, locationId: string): Promise<any[]> {
    // Verify location belongs to this network
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, networkId, deletedAt: null },
    });

    if (!location) {
      throw new NotFoundException('Helyszín nem található');
    }

    const services = await this.prisma.locationServiceAvailability.findMany({
      where: { locationId, networkId, isActive: true },
      include: {
        servicePackage: true,
      },
      orderBy: { servicePackage: { name: 'asc' } },
    });

    return services.map((s) => ({
      id: s.id,
      servicePackageId: s.servicePackageId,
      servicePackageName: s.servicePackage.name,
      servicePackageCode: s.servicePackage.code,
      isActive: s.isActive,
    }));
  }

  async addLocationService(
    networkId: string,
    locationId: string,
    servicePackageId: string,
  ): Promise<any> {
    // Verify location belongs to this network
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, networkId, deletedAt: null },
    });

    if (!location) {
      throw new NotFoundException('Helyszín nem található');
    }

    // Verify service package belongs to this network
    const servicePackage = await this.prisma.servicePackage.findFirst({
      where: { id: servicePackageId, networkId, deletedAt: null },
    });

    if (!servicePackage) {
      throw new NotFoundException('Szolgáltatás csomag nem található');
    }

    // Check if already exists
    const existing = await this.prisma.locationServiceAvailability.findFirst({
      where: { locationId, servicePackageId },
    });

    if (existing) {
      // Reactivate if inactive
      if (!existing.isActive) {
        const updated = await this.prisma.locationServiceAvailability.update({
          where: { id: existing.id },
          data: { isActive: true },
          include: { servicePackage: true },
        });
        return {
          id: updated.id,
          servicePackageId: updated.servicePackageId,
          servicePackageName: updated.servicePackage.name,
          servicePackageCode: updated.servicePackage.code,
          isActive: updated.isActive,
        };
      }
      throw new ConflictException('Ez a szolgáltatás már hozzá van adva ehhez a helyszínhez');
    }

    const service = await this.prisma.locationServiceAvailability.create({
      data: {
        networkId,
        locationId,
        servicePackageId,
      },
      include: { servicePackage: true },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'CREATE',
      actorType: 'USER',
      newData: {
        type: 'LOCATION_SERVICE',
        locationId,
        locationName: location.name,
        servicePackageId,
        servicePackageName: servicePackage.name,
      },
      metadata: { entityType: 'location_service' },
    });

    return {
      id: service.id,
      servicePackageId: service.servicePackageId,
      servicePackageName: service.servicePackage.name,
      servicePackageCode: service.servicePackage.code,
      isActive: service.isActive,
    };
  }

  async removeLocationService(
    networkId: string,
    locationId: string,
    servicePackageId: string,
  ): Promise<void> {
    // Verify location belongs to this network
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, networkId, deletedAt: null },
    });

    if (!location) {
      throw new NotFoundException('Helyszín nem található');
    }

    const service = await this.prisma.locationServiceAvailability.findFirst({
      where: { locationId, servicePackageId, networkId },
      include: { servicePackage: true },
    });

    if (!service) {
      throw new NotFoundException('Szolgáltatás nem található ezen a helyszínen');
    }

    await this.prisma.locationServiceAvailability.update({
      where: { id: service.id },
      data: { isActive: false },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      previousData: {
        type: 'LOCATION_SERVICE',
        locationId,
        locationName: location.name,
        servicePackageId,
        servicePackageName: service.servicePackage.name,
        isActive: true,
      },
      newData: {
        type: 'LOCATION_SERVICE',
        locationId,
        servicePackageId,
        deleted: true,
      },
      metadata: { entityType: 'location_service', operation: 'delete' },
    });
  }
}
