import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogService } from '../modules/audit-log/audit-log.service';
import { EmailService } from '../modules/email/email.service';
import { AccountLockoutService } from '../common/security/account-lockout.service';
import { RefreshTokenService } from '../common/auth/refresh-token.service';
import { assertValidPassword } from '../common/security/password-policy';
import { PlatformRole, SubscriptionStatus, NetworkRole, AuditAction, CompanyDataProvider, RefreshTokenType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  CreatePlatformAdminDto,
  PlatformLoginDto,
  PlatformLoginResponseDto,
  UpdatePlatformSettingsDto,
  PlatformSettingsResponseDto,
  CreateNetworkDto,
  UpdateNetworkDto,
  NetworkListItemDto,
  NetworkDetailDto,
  PlatformDashboardDto,
  NetworkAdminDto,
  CreateNetworkAdminDto,
  UpdateNetworkAdminDto,
  UpdatePlatformAdminDto,
  PlatformAdminListItemDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  GenerateEmergencyTokenResponseDto,
  EmergencyLoginDto,
} from './dto/platform-admin.dto';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly emailService: EmailService,
    private readonly lockoutService: AccountLockoutService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  // SECURITY: Get JWT secret with production check
  private getJwtSecret(): string {
    const secret = this.configService.get('JWT_SECRET');
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return secret || 'dev-only-secret-do-not-use-in-production';
  }

  // =========================================================================
  // AUTH
  // =========================================================================

  async login(dto: PlatformLoginDto, ipAddress?: string, userAgent?: string): Promise<PlatformLoginResponseDto> {
    const email = dto.email.toLowerCase();

    // SECURITY: Check if account is locked
    const lockStatus = this.lockoutService.isLocked(email);
    if (lockStatus.isLocked) {
      await this.auditLogService.log({
        action: AuditAction.LOGIN_FAILED,
        actorType: 'PLATFORM_ADMIN',
        metadata: { email, error: 'Account locked', remainingSeconds: lockStatus.remainingSeconds },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException(
        `Fiók ideiglenesen zárolva. Próbálja újra ${Math.ceil((lockStatus.remainingSeconds || 0) / 60)} perc múlva.`
      );
    }

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email },
    });

    if (!admin || !admin.isActive) {
      // SECURITY: Record failed attempt
      const lockResult = this.lockoutService.recordFailedAttempt(email);

      // AUDIT: Log failed login - admin not found
      await this.auditLogService.log({
        action: AuditAction.LOGIN_FAILED,
        actorType: 'PLATFORM_ADMIN',
        metadata: {
          email,
          error: 'Admin not found or inactive',
          attemptsRemaining: lockResult.attemptsRemaining,
          isNowLocked: lockResult.isNowLocked,
        },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Hibás email vagy jelszó');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isPasswordValid) {
      // SECURITY: Record failed attempt
      const lockResult = this.lockoutService.recordFailedAttempt(email);

      // AUDIT: Log failed login - invalid password
      await this.auditLogService.log({
        action: AuditAction.LOGIN_FAILED,
        actorType: 'PLATFORM_ADMIN',
        actorId: admin.id,
        metadata: {
          email,
          error: 'Invalid password',
          attemptsRemaining: lockResult.attemptsRemaining,
          isNowLocked: lockResult.isNowLocked,
        },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Hibás email vagy jelszó');
    }

    // SECURITY: Clear failed attempts on successful login
    this.lockoutService.clearFailedAttempts(email);

    // Update last login
    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'platform' as const,
    };

    // SECURITY: Generate token pair with refresh token
    const tokenPair = await this.refreshTokenService.createTokenPair(
      payload,
      RefreshTokenType.PLATFORM_ADMIN,
      { userAgent, ipAddress },
    );

    // AUDIT: Log successful login
    await this.auditLogService.log({
      action: AuditAction.LOGIN_SUCCESS,
      actorType: 'PLATFORM_ADMIN',
      actorId: admin.id,
      metadata: { email: dto.email.toLowerCase(), role: admin.role },
      ipAddress,
      userAgent,
    });

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
      adminId: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };
  }

  // =========================================================================
  // REFRESH TOKEN
  // =========================================================================

  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const tokenPair = await this.refreshTokenService.refreshTokens(refreshToken, {
      ipAddress,
      userAgent,
    });

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenService.revokeToken(refreshToken);
  }

  async logoutAll(adminId: string): Promise<number> {
    return this.refreshTokenService.revokeAllUserTokens(adminId, RefreshTokenType.PLATFORM_ADMIN);
  }

  // =========================================================================
  // ADMIN MANAGEMENT
  // =========================================================================

  async createAdmin(dto: CreatePlatformAdminDto, createdByAdminId?: string): Promise<{ id: string; email: string }> {
    const existing = await this.prisma.platformAdmin.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Ez az email cím már regisztrálva van');
    }

    // Recovery email kötelező PLATFORM_OWNER esetén
    if (dto.role === PlatformRole.PLATFORM_OWNER && !dto.recoveryEmail) {
      throw new ConflictException('Recovery email kötelező PLATFORM_OWNER jogosultsághoz');
    }

    // SECURITY: Validate password strength
    assertValidPassword(dto.password);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const admin = await this.prisma.platformAdmin.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        role: dto.role || PlatformRole.PLATFORM_ADMIN,
        recoveryEmail: dto.recoveryEmail?.toLowerCase(),
      },
    });

    // AUDIT: Log admin creation
    await this.auditLogService.log({
      action: AuditAction.ADMIN_CREATED,
      actorType: 'PLATFORM_ADMIN',
      actorId: createdByAdminId,
      newData: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      metadata: { targetAdminId: admin.id, targetEmail: admin.email },
    });

    return { id: admin.id, email: admin.email };
  }

  // =========================================================================
  // PLATFORM ADMIN MANAGEMENT
  // =========================================================================

  async listAdmins(): Promise<PlatformAdminListItemDto[]> {
    const admins = await this.prisma.platformAdmin.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });

    return admins.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      role: a.role,
      isActive: a.isActive,
      recoveryEmail: a.recoveryEmail || undefined,
      lastLoginAt: a.lastLoginAt || undefined,
      createdAt: a.createdAt,
    }));
  }

  async getAdmin(adminId: string): Promise<PlatformAdminListItemDto> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Platform admin nem található');
    }

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
      recoveryEmail: admin.recoveryEmail || undefined,
      lastLoginAt: admin.lastLoginAt || undefined,
      createdAt: admin.createdAt,
    };
  }

  async updateAdmin(
    adminId: string,
    dto: UpdatePlatformAdminDto,
    currentAdminId: string,
  ): Promise<PlatformAdminListItemDto> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Platform admin nem található');
    }

    // Nem törölheti ki magát
    if (adminId === currentAdminId && dto.isActive === false) {
      throw new ConflictException('Nem deaktiválhatod saját magadat');
    }

    // Ha OWNER-ré válik, recovery email kötelező
    if (dto.role === PlatformRole.PLATFORM_OWNER) {
      const newRecoveryEmail = dto.recoveryEmail || admin.recoveryEmail;
      if (!newRecoveryEmail) {
        throw new ConflictException('Recovery email kötelező PLATFORM_OWNER jogosultsághoz');
      }
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.recoveryEmail !== undefined) updateData.recoveryEmail = dto.recoveryEmail.toLowerCase();
    if (dto.password) {
      // SECURITY: Validate password strength
      assertValidPassword(dto.password);
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const updated = await this.prisma.platformAdmin.update({
      where: { id: adminId },
      data: updateData,
    });

    // AUDIT: Log admin update
    await this.auditLogService.log({
      action: AuditAction.ADMIN_UPDATED,
      actorType: 'PLATFORM_ADMIN',
      actorId: currentAdminId,
      previousData: { name: admin.name, role: admin.role, isActive: admin.isActive },
      newData: { name: updated.name, role: updated.role, isActive: updated.isActive },
      metadata: { targetAdminId: adminId, targetEmail: admin.email },
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
      recoveryEmail: updated.recoveryEmail || undefined,
      lastLoginAt: updated.lastLoginAt || undefined,
      createdAt: updated.createdAt,
    };
  }

  async deleteAdmin(adminId: string, currentAdminId: string): Promise<void> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Platform admin nem található');
    }

    // Nem törölheti ki magát
    if (adminId === currentAdminId) {
      throw new ConflictException('Nem törölheted saját magadat');
    }

    // Ellenőrizzük, hogy marad-e legalább egy aktív OWNER
    if (admin.role === PlatformRole.PLATFORM_OWNER) {
      const ownerCount = await this.prisma.platformAdmin.count({
        where: {
          role: PlatformRole.PLATFORM_OWNER,
          isActive: true,
          id: { not: adminId },
        },
      });

      if (ownerCount === 0) {
        throw new ConflictException('Nem törölheted az utolsó aktív PLATFORM_OWNER-t');
      }
    }

    await this.prisma.platformAdmin.delete({
      where: { id: adminId },
    });

    // AUDIT: Log admin deletion
    await this.auditLogService.log({
      action: AuditAction.ADMIN_DELETED,
      actorType: 'PLATFORM_ADMIN',
      actorId: currentAdminId,
      previousData: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      metadata: { targetAdminId: adminId, targetEmail: admin.email },
    });
  }

  // =========================================================================
  // PASSWORD RESET
  // =========================================================================

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<{ message: string }> {
    // Keresünk email vagy recoveryEmail alapján
    const admin = await this.prisma.platformAdmin.findFirst({
      where: {
        OR: [
          { email: dto.email.toLowerCase() },
          { recoveryEmail: dto.email.toLowerCase() },
        ],
        isActive: true,
      },
    });

    if (!admin) {
      // Biztonság: ne áruljuk el, hogy nincs ilyen email
      return { message: 'Ha az email cím létezik, elküldtük a jelszó-visszaállító linket' };
    }

    // Token generálás (32 byte = 64 hex karakter)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 óra

    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    const platformUrl = this.configService.get('PLATFORM_URL') || 'https://app.vemiax.com';
    const resetLink = `${platformUrl}/platform-admin/reset-password?token=${resetToken}`;

    this.logger.log(`Password reset link for ${admin.email}: ${resetLink}`);

    // Send password reset email
    try {
      await this.emailService.sendPasswordResetEmail(
        admin.email,
        admin.name,
        resetLink,
      );
      this.logger.log(`Password reset email sent to ${admin.email}`);
    } catch (emailError) {
      this.logger.error(`Failed to send password reset email to ${admin.email}: ${emailError.message}`);
      // Don't throw - still allow the process to continue
    }

    return { message: 'Ha az email cím létezik, elküldtük a jelszó-visszaállító linket' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const admin = await this.prisma.platformAdmin.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: { gt: new Date() },
        isActive: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Érvénytelen vagy lejárt token');
    }

    // SECURITY: Validate password strength
    assertValidPassword(dto.newPassword);

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return { message: 'Jelszó sikeresen megváltoztatva' };
  }

  // =========================================================================
  // EMERGENCY TOKEN (Vészhelyzeti hozzáférés)
  // =========================================================================

  async generateEmergencyToken(adminId: string): Promise<GenerateEmergencyTokenResponseDto> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== PlatformRole.PLATFORM_OWNER) {
      throw new UnauthorizedException('Csak PLATFORM_OWNER generálhat emergency token-t');
    }

    // 64 byte = 128 hex karakter erős token
    const emergencyToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 nap

    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        emergencyToken,
        emergencyTokenExpires: expiresAt,
      },
    });

    // Token mentése fájlba (biztonságos helyre)
    const emergencyDir = path.join(process.cwd(), 'emergency-tokens');
    if (!fs.existsSync(emergencyDir)) {
      fs.mkdirSync(emergencyDir, { recursive: true });
    }

    const tokenFile = path.join(emergencyDir, `emergency-${admin.id}.txt`);
    const tokenContent = `
VSys Platform Emergency Access Token
=====================================
Admin: ${admin.name} (${admin.email})
Token: ${emergencyToken}
Expires: ${expiresAt.toISOString()}
Generated: ${new Date().toISOString()}

FIGYELEM: Ezt a tokent biztonságos helyen tárold!
Használat: POST /platform-admin/emergency-login { "token": "${emergencyToken}" }
=====================================
`;

    fs.writeFileSync(tokenFile, tokenContent);
    this.logger.warn(`Emergency token generated for ${admin.email}, saved to ${tokenFile}`);

    return {
      token: emergencyToken,
      expiresAt,
      message: `Emergency token generálva és mentve: ${tokenFile}`,
    };
  }

  async emergencyLogin(dto: EmergencyLoginDto): Promise<PlatformLoginResponseDto> {
    const admin = await this.prisma.platformAdmin.findFirst({
      where: {
        emergencyToken: dto.token,
        emergencyTokenExpires: { gt: new Date() },
        role: PlatformRole.PLATFORM_OWNER,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Érvénytelen vagy lejárt emergency token');
    }

    // Token egyszeri használat - töröljük
    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        emergencyToken: null,
        emergencyTokenExpires: null,
        lastLoginAt: new Date(),
      },
    });

    this.logger.warn(`Emergency login used for ${admin.email}`);

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'platform' as const,
    };

    // SECURITY: Emergency login also uses refresh tokens but with shorter expiry
    const tokenPair = await this.refreshTokenService.createTokenPair(
      payload,
      RefreshTokenType.PLATFORM_ADMIN,
      { userAgent: 'emergency-login' },
    );

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
      adminId: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };
  }

  async validateToken(token: string): Promise<{ adminId: string; role: PlatformRole } | null> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.getJwtSecret(),
      });

      if (payload.type !== 'platform') {
        return null;
      }

      return { adminId: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }

  // =========================================================================
  // PLATFORM SETTINGS
  // =========================================================================

  async getSettings(): Promise<PlatformSettingsResponseDto> {
    let settings = await this.prisma.platformSettings.findFirst();

    if (!settings) {
      settings = await this.prisma.platformSettings.create({
        data: { platformName: 'VSys Wash' },
      });
    }

    // Check if invoice provider is configured
    const invoiceConfigured = settings.invoiceProvider !== 'NONE' && (
      (settings.invoiceProvider === 'SZAMLAZZ' && !!settings.szamlazzAgentKey) ||
      (settings.invoiceProvider === 'BILLINGO' && !!settings.billingoApiKey && !!settings.billingoBlockId)
    );

    return {
      id: settings.id,
      platformName: settings.platformName,
      platformUrl: settings.platformUrl || undefined,
      supportEmail: settings.supportEmail || undefined,
      supportPhone: settings.supportPhone || undefined,
      defaultTrialDays: settings.defaultTrialDays,
      baseMonthlyFee: Number(settings.baseMonthlyFee),
      perWashFee: Number(settings.perWashFee),
      emailConfigured: !!settings.resendApiKey,
      smsConfigured: !!settings.twilioAccountSid && !!settings.twilioAuthToken,
      stripeConfigured: !!settings.stripeSecretKey && !!settings.stripeBasePriceId,
      invoiceConfigured,
      invoiceProvider: settings.invoiceProvider,
    };
  }

  async updateSettings(dto: UpdatePlatformSettingsDto): Promise<PlatformSettingsResponseDto> {
    let settings = await this.prisma.platformSettings.findFirst();

    if (!settings) {
      settings = await this.prisma.platformSettings.create({
        data: { platformName: 'VSys Wash' },
      });
    }

    const updated = await this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: {
        platformName: dto.platformName,
        platformUrl: dto.platformUrl,
        supportEmail: dto.supportEmail,
        supportPhone: dto.supportPhone,
        // Company data
        companyName: dto.companyName,
        companyAddress: dto.companyAddress,
        companyCity: dto.companyCity,
        companyZipCode: dto.companyZipCode,
        companyCountry: dto.companyCountry,
        taxNumber: dto.taxNumber,
        euVatNumber: dto.euVatNumber,
        bankAccountNumber: dto.bankAccountNumber,
        bankAccountIban: dto.bankAccountIban,
        bankName: dto.bankName,
        // Pricing
        defaultTrialDays: dto.defaultTrialDays,
        baseMonthlyFee: dto.baseMonthlyFee,
        perWashFee: dto.perWashFee,
        // Email
        resendApiKey: dto.resendApiKey,
        // SMS
        twilioAccountSid: dto.twilioAccountSid,
        twilioAuthToken: dto.twilioAuthToken,
        twilioPhoneNumber: dto.twilioPhoneNumber,
        // Stripe
        stripeSecretKey: dto.stripeSecretKey,
        stripePublishableKey: dto.stripePublishableKey,
        stripeWebhookSecret: dto.stripeWebhookSecret,
        stripeProductId: dto.stripeProductId,
        stripeBasePriceId: dto.stripeBasePriceId,
        stripeUsagePriceId: dto.stripeUsagePriceId,
        // Invoice provider
        invoiceProvider: dto.invoiceProvider,
        szamlazzAgentKey: dto.szamlazzAgentKey,
        billingoApiKey: dto.billingoApiKey,
        billingoBlockId: dto.billingoBlockId,
        billingoBankAccountId: dto.billingoBankAccountId,
      },
    });

    // Check if invoice provider is configured
    const invoiceConfigured = updated.invoiceProvider !== 'NONE' && (
      (updated.invoiceProvider === 'SZAMLAZZ' && !!updated.szamlazzAgentKey) ||
      (updated.invoiceProvider === 'BILLINGO' && !!updated.billingoApiKey && !!updated.billingoBlockId)
    );

    return {
      id: updated.id,
      platformName: updated.platformName,
      platformUrl: updated.platformUrl || undefined,
      supportEmail: updated.supportEmail || undefined,
      supportPhone: updated.supportPhone || undefined,
      defaultTrialDays: updated.defaultTrialDays,
      baseMonthlyFee: Number(updated.baseMonthlyFee),
      perWashFee: Number(updated.perWashFee),
      emailConfigured: !!updated.resendApiKey,
      smsConfigured: !!updated.twilioAccountSid && !!updated.twilioAuthToken,
      stripeConfigured: !!updated.stripeSecretKey && !!updated.stripeBasePriceId,
      invoiceConfigured,
      invoiceProvider: updated.invoiceProvider,
    };
  }

  // =========================================================================
  // NETWORK MANAGEMENT
  // =========================================================================

  async listNetworks(): Promise<NetworkListItemDto[]> {
    const networks = await this.prisma.network.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            locations: { where: { deletedAt: null } },
            drivers: { where: { deletedAt: null } },
            washEvents: true,
          },
        },
      },
    });

    return networks.map((n) => ({
      id: n.id,
      name: n.name,
      slug: n.slug,
      isActive: n.isActive,
      subscriptionStatus: n.subscriptionStatus,
      trialEndsAt: n.trialEndsAt || undefined,
      country: n.country,
      defaultCurrency: n.defaultCurrency,
      createdAt: n.createdAt,
      locationCount: n._count.locations,
      driverCount: n._count.drivers,
      washEventCount: n._count.washEvents,
    }));
  }

  async getNetwork(id: string): Promise<NetworkDetailDto> {
    const [network, settings] = await Promise.all([
      this.prisma.network.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              locations: { where: { deletedAt: null } },
              drivers: { where: { deletedAt: null } },
              washEvents: true,
              partnerCompanies: { where: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.platformSettings.findFirst(),
    ]);

    if (!network || network.deletedAt) {
      throw new NotFoundException('Network nem található');
    }

    // Platform alapértelmezett árak
    const platformMonthlyFee = Number(settings?.baseMonthlyFee || 0);
    const platformPerWashFee = Number(settings?.perWashFee || 0);

    // Egyedi vagy platform árak
    const customMonthlyFee = network.customMonthlyFee !== null ? Number(network.customMonthlyFee) : null;
    const customPerWashFee = network.customPerWashFee !== null ? Number(network.customPerWashFee) : null;

    // Billing data completeness check
    const billingDataComplete = !!(
      network.billingCompanyName &&
      network.billingAddress &&
      network.billingCity &&
      network.billingZipCode &&
      network.billingTaxNumber
    );

    return {
      id: network.id,
      name: network.name,
      slug: network.slug,
      isActive: network.isActive,
      subscriptionStatus: network.subscriptionStatus,
      trialEndsAt: network.trialEndsAt || undefined,
      subscriptionStartAt: network.subscriptionStartAt || undefined,
      subscriptionEndAt: network.subscriptionEndAt || undefined,
      country: network.country,
      timezone: network.timezone,
      defaultCurrency: network.defaultCurrency,
      defaultLanguage: network.defaultLanguage,
      createdAt: network.createdAt,
      locationCount: network._count.locations,
      driverCount: network._count.drivers,
      washEventCount: network._count.washEvents,
      partnerCompanyCount: network._count.partnerCompanies,
      // Árazás
      customMonthlyFee,
      customPerWashFee,
      pricingNotes: network.pricingNotes,
      platformMonthlyFee,
      platformPerWashFee,
      effectiveMonthlyFee: customMonthlyFee !== null ? customMonthlyFee : platformMonthlyFee,
      effectivePerWashFee: customPerWashFee !== null ? customPerWashFee : platformPerWashFee,
      // Platform billing data
      billingCompanyName: network.billingCompanyName || undefined,
      billingAddress: network.billingAddress || undefined,
      billingCity: network.billingCity || undefined,
      billingZipCode: network.billingZipCode || undefined,
      billingCountry: network.billingCountry,
      billingTaxNumber: network.billingTaxNumber || undefined,
      billingEuVatNumber: network.billingEuVatNumber || undefined,
      billingEmail: network.billingEmail || undefined,
      billingDataComplete,
    };
  }

  async createNetwork(dto: CreateNetworkDto): Promise<NetworkDetailDto> {
    // Check slug uniqueness
    const existing = await this.prisma.network.findUnique({
      where: { slug: dto.slug.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Ez a slug már foglalt');
    }

    // Get platform settings for trial days
    const settings = await this.prisma.platformSettings.findFirst();
    const trialDays = settings?.defaultTrialDays || 14;

    const network = await this.prisma.network.create({
      data: {
        name: dto.name,
        slug: dto.slug.toLowerCase(),
        country: dto.country || 'HU',
        timezone: dto.timezone || 'Europe/Budapest',
        defaultCurrency: dto.defaultCurrency || 'HUF',
        subscriptionStatus: SubscriptionStatus.TRIAL,
        trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
      },
    });

    // Create network settings
    await this.prisma.networkSettings.create({
      data: { networkId: network.id },
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

    // Create network owner admin if provided
    if (dto.ownerEmail && dto.ownerPassword) {
      // SECURITY: Validate password strength
      assertValidPassword(dto.ownerPassword);
      const passwordHash = await bcrypt.hash(dto.ownerPassword, 12);
      await this.prisma.networkAdmin.create({
        data: {
          networkId: network.id,
          email: dto.ownerEmail.toLowerCase(),
          passwordHash,
          name: dto.ownerName || dto.ownerEmail.split('@')[0],
          role: 'NETWORK_OWNER',
        },
      });
    }

    // AUDIT: Log network creation
    await this.auditLogService.log({
      networkId: network.id,
      action: AuditAction.CREATE,
      actorType: 'PLATFORM_ADMIN',
      newData: { id: network.id, name: network.name, slug: network.slug },
      metadata: { entityType: 'network', ownerEmail: dto.ownerEmail },
    });

    return this.getNetwork(network.id);
  }

  async updateNetwork(id: string, dto: UpdateNetworkDto, updatedByAdminId?: string): Promise<NetworkDetailDto> {
    const network = await this.prisma.network.findUnique({ where: { id } });

    if (!network || network.deletedAt) {
      throw new NotFoundException('Network nem található');
    }

    // Egyedi árazás kezelése: ha undefined marad a DTO-ban, ne módosítsuk
    // Ha explicit null-t küld, töröljük az egyedi árat (platform default lesz)
    // Ha számot küld, beállítjuk az egyedi árat
    const updateData: any = {
      name: dto.name,
      isActive: dto.isActive,
      subscriptionStatus: dto.subscriptionStatus,
      trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : undefined,
      country: dto.country,
      timezone: dto.timezone,
      defaultCurrency: dto.defaultCurrency,
    };

    // Egyedi árazás mezők (csak ha explicit meg van adva)
    if (dto.customMonthlyFee !== undefined) {
      updateData.customMonthlyFee = dto.customMonthlyFee;
    }
    if (dto.customPerWashFee !== undefined) {
      updateData.customPerWashFee = dto.customPerWashFee;
    }
    if (dto.pricingNotes !== undefined) {
      updateData.pricingNotes = dto.pricingNotes;
    }

    // Platform billing data (számlázási adatok a Platform felé)
    if (dto.billingCompanyName !== undefined) {
      updateData.billingCompanyName = dto.billingCompanyName;
    }
    if (dto.billingAddress !== undefined) {
      updateData.billingAddress = dto.billingAddress;
    }
    if (dto.billingCity !== undefined) {
      updateData.billingCity = dto.billingCity;
    }
    if (dto.billingZipCode !== undefined) {
      updateData.billingZipCode = dto.billingZipCode;
    }
    if (dto.billingCountry !== undefined) {
      updateData.billingCountry = dto.billingCountry;
    }
    if (dto.billingTaxNumber !== undefined) {
      updateData.billingTaxNumber = dto.billingTaxNumber;
    }
    if (dto.billingEuVatNumber !== undefined) {
      updateData.billingEuVatNumber = dto.billingEuVatNumber;
    }
    if (dto.billingEmail !== undefined) {
      updateData.billingEmail = dto.billingEmail;
    }

    await this.prisma.network.update({
      where: { id },
      data: updateData,
    });

    // AUDIT: Log network update
    await this.auditLogService.log({
      networkId: id,
      action: AuditAction.UPDATE,
      actorType: 'PLATFORM_ADMIN',
      actorId: updatedByAdminId,
      previousData: { name: network.name, isActive: network.isActive, subscriptionStatus: network.subscriptionStatus },
      newData: { name: dto.name, isActive: dto.isActive, subscriptionStatus: dto.subscriptionStatus },
      metadata: { entityType: 'network' },
    });

    // Check if trial was extended and send notification
    if (dto.trialEndsAt) {
      const newTrialEndsAt = new Date(dto.trialEndsAt);
      const oldTrialEndsAt = network.trialEndsAt;

      // Only if trial date changed (extended or set)
      if (!oldTrialEndsAt || newTrialEndsAt.getTime() !== oldTrialEndsAt.getTime()) {
        // AUDIT: Log trial extension specifically
        await this.auditLogService.log({
          networkId: id,
          action: AuditAction.UPDATE,
          actorType: 'PLATFORM_ADMIN',
          actorId: updatedByAdminId,
          previousData: { trialEndsAt: oldTrialEndsAt?.toISOString() || null },
          newData: { trialEndsAt: newTrialEndsAt.toISOString() },
          metadata: {
            entityType: 'network',
            actionSubtype: 'TRIAL_EXTENSION',
            networkName: network.name,
          },
        });

        // Send email notification to network admin
        await this.notifyNetworkAdminTrialExtended(id, network.name, oldTrialEndsAt, newTrialEndsAt);
      }
    }

    return this.getNetwork(id);
  }

  async deleteNetwork(id: string, deletedByAdminId?: string): Promise<void> {
    const network = await this.prisma.network.findUnique({ where: { id } });

    if (!network) {
      throw new NotFoundException('Network nem található');
    }

    const now = new Date();
    const timestamp = now.getTime();

    // Soft delete network - modify slug to allow re-registration with same slug
    await this.prisma.network.update({
      where: { id },
      data: {
        deletedAt: now,
        isActive: false,
        slug: `${network.slug}_deleted_${timestamp}`, // Modify slug to free it up
      },
    });

    // Soft delete all network admins and modify their emails
    const admins = await this.prisma.networkAdmin.findMany({
      where: { networkId: id, deletedAt: null },
    });

    for (const admin of admins) {
      await this.prisma.networkAdmin.update({
        where: { id: admin.id },
        data: {
          deletedAt: now,
          isActive: false,
          email: `${admin.email}_deleted_${timestamp}`, // Modify email to free it up
        },
      });
    }

    // AUDIT: Log network deletion
    await this.auditLogService.log({
      networkId: id,
      action: AuditAction.DELETE,
      actorType: 'PLATFORM_ADMIN',
      actorId: deletedByAdminId,
      previousData: { id: network.id, name: network.name, slug: network.slug },
      metadata: { entityType: 'network', deletedAdminsCount: admins.length },
    });
  }

  // =========================================================================
  // NETWORK ADMIN MANAGEMENT
  // =========================================================================

  async listNetworkAdmins(networkId: string): Promise<NetworkAdminDto[]> {
    const admins = await this.prisma.networkAdmin.findMany({
      where: { networkId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return admins.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      role: a.role,
      isActive: a.isActive,
      lastLoginAt: a.lastLoginAt || undefined,
      createdAt: a.createdAt,
    }));
  }

  async getNetworkAdmin(networkId: string, adminId: string): Promise<NetworkAdminDto> {
    const admin = await this.prisma.networkAdmin.findFirst({
      where: { id: adminId, networkId, deletedAt: null },
    });

    if (!admin) {
      throw new NotFoundException('Network admin nem található');
    }

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt || undefined,
      createdAt: admin.createdAt,
    };
  }

  async createNetworkAdmin(networkId: string, dto: CreateNetworkAdminDto): Promise<NetworkAdminDto> {
    // Check if network exists
    const network = await this.prisma.network.findUnique({ where: { id: networkId } });
    if (!network || network.deletedAt) {
      throw new NotFoundException('Network nem található');
    }

    // Check if email already used in this network
    const existing = await this.prisma.networkAdmin.findFirst({
      where: { networkId, email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (existing) {
      throw new ConflictException('Ez az email cím már regisztrálva van ebben a hálózatban');
    }

    // SECURITY: Validate password strength
    assertValidPassword(dto.password);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const admin = await this.prisma.networkAdmin.create({
      data: {
        networkId,
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        role: (dto.role as NetworkRole) || NetworkRole.NETWORK_ADMIN,
      },
    });

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt || undefined,
      createdAt: admin.createdAt,
    };
  }

  async updateNetworkAdmin(networkId: string, adminId: string, dto: UpdateNetworkAdminDto): Promise<NetworkAdminDto> {
    const admin = await this.prisma.networkAdmin.findFirst({
      where: { id: adminId, networkId, deletedAt: null },
    });

    if (!admin) {
      throw new NotFoundException('Network admin nem található');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.password) {
      // SECURITY: Validate password strength
      assertValidPassword(dto.password);
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const updated = await this.prisma.networkAdmin.update({
      where: { id: adminId },
      data: updateData,
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
      lastLoginAt: updated.lastLoginAt || undefined,
      createdAt: updated.createdAt,
    };
  }

  async deleteNetworkAdmin(networkId: string, adminId: string): Promise<void> {
    const admin = await this.prisma.networkAdmin.findFirst({
      where: { id: adminId, networkId, deletedAt: null },
    });

    if (!admin) {
      throw new NotFoundException('Network admin nem található');
    }

    // Soft delete
    await this.prisma.networkAdmin.update({
      where: { id: adminId },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  async getDashboard(): Promise<PlatformDashboardDto> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalNetworks,
      activeNetworks,
      trialNetworks,
      totalLocations,
      totalDrivers,
      washEventsThisMonth,
      networksExpiringSoon,
    ] = await Promise.all([
      this.prisma.network.count({ where: { deletedAt: null } }),
      this.prisma.network.count({
        where: { deletedAt: null, isActive: true, subscriptionStatus: 'ACTIVE' },
      }),
      this.prisma.network.count({
        where: { deletedAt: null, subscriptionStatus: 'TRIAL' },
      }),
      this.prisma.location.count({ where: { deletedAt: null } }),
      this.prisma.driver.count({ where: { deletedAt: null } }),
      this.prisma.washEvent.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.network.findMany({
        where: {
          deletedAt: null,
          subscriptionStatus: 'TRIAL',
          trialEndsAt: { lte: sevenDaysFromNow, gte: now },
        },
        include: {
          _count: {
            select: {
              locations: { where: { deletedAt: null } },
              drivers: { where: { deletedAt: null } },
              washEvents: true,
            },
          },
        },
        orderBy: { trialEndsAt: 'asc' },
      }),
    ]);

    // Calculate platform revenue (simplified - would need proper billing integration)
    const settings = await this.prisma.platformSettings.findFirst();
    const perWashFee = Number(settings?.perWashFee || 0);
    const revenueThisMonth = washEventsThisMonth * perWashFee;

    return {
      totalNetworks,
      activeNetworks,
      trialNetworks,
      totalLocations,
      totalDrivers,
      washEventsThisMonth,
      revenueThisMonth,
      networksExpiringSoon: networksExpiringSoon.map((n) => ({
        id: n.id,
        name: n.name,
        slug: n.slug,
        isActive: n.isActive,
        subscriptionStatus: n.subscriptionStatus,
        trialEndsAt: n.trialEndsAt || undefined,
        country: n.country,
        defaultCurrency: n.defaultCurrency,
        createdAt: n.createdAt,
        locationCount: n._count.locations,
        driverCount: n._count.drivers,
        washEventCount: n._count.washEvents,
      })),
    };
  }

  // =========================================================================
  // REPORTS
  // =========================================================================

  async getReports(period: 'month' | 'quarter' | 'year'): Promise<{
    networkStats: any[];
    monthlyStats: any[];
    totals: {
      totalWashEvents: number;
      totalRevenue: number;
      avgWashesPerNetwork: number;
      avgWashesPerLocation: number;
    };
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Determine period start date
    let periodStart: Date;
    let monthCount: number;
    switch (period) {
      case 'quarter':
        periodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        monthCount = 3;
        break;
      case 'year':
        periodStart = new Date(now.getFullYear(), 0, 1);
        monthCount = 12;
        break;
      default:
        periodStart = startOfMonth;
        monthCount = 1;
    }

    // Get all active networks with their stats
    const networks = await this.prisma.network.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            locations: { where: { deletedAt: null } },
            drivers: { where: { deletedAt: null } },
          },
        },
      },
    });

    // Get wash events per network
    const networkStats = await Promise.all(
      networks.map(async (network) => {
        const [washEventsThisMonth, washEventsLastMonth, totalWashEvents] = await Promise.all([
          this.prisma.washEvent.count({
            where: { networkId: network.id, createdAt: { gte: startOfMonth } },
          }),
          this.prisma.washEvent.count({
            where: {
              networkId: network.id,
              createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
            },
          }),
          this.prisma.washEvent.count({
            where: { networkId: network.id },
          }),
        ]);

        const settings = await this.prisma.platformSettings.findFirst();
        const perWashFee = Number(settings?.perWashFee || 0);

        return {
          id: network.id,
          name: network.name,
          slug: network.slug,
          subscriptionStatus: network.subscriptionStatus,
          washEventsThisMonth,
          washEventsLastMonth,
          totalWashEvents,
          activeDrivers: network._count.drivers,
          activeLocations: network._count.locations,
          revenue: washEventsThisMonth * perWashFee,
        };
      })
    );

    // Get monthly stats for the period
    const monthlyStats: any[] = [];
    for (let i = 0; i < monthCount; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthStart.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' });

      const [washEvents, newNetworks, newDrivers] = await Promise.all([
        this.prisma.washEvent.count({
          where: { createdAt: { gte: monthStart, lte: monthEnd } },
        }),
        this.prisma.network.count({
          where: { createdAt: { gte: monthStart, lte: monthEnd }, deletedAt: null },
        }),
        this.prisma.driver.count({
          where: { createdAt: { gte: monthStart, lte: monthEnd }, deletedAt: null },
        }),
      ]);

      const settings = await this.prisma.platformSettings.findFirst();
      const perWashFee = Number(settings?.perWashFee || 0);

      monthlyStats.push({
        month: monthName,
        washEvents,
        revenue: washEvents * perWashFee,
        newNetworks,
        newDrivers,
      });
    }

    // Calculate totals
    const totalWashEvents = networkStats.reduce((sum, n) => sum + n.totalWashEvents, 0);
    const totalRevenue = networkStats.reduce((sum, n) => sum + n.revenue, 0);
    const totalLocations = networkStats.reduce((sum, n) => sum + n.activeLocations, 0);
    const activeNetworksCount = networks.filter(n => n.isActive).length;

    return {
      networkStats: networkStats.sort((a, b) => b.washEventsThisMonth - a.washEventsThisMonth),
      monthlyStats,
      totals: {
        totalWashEvents,
        totalRevenue,
        avgWashesPerNetwork: activeNetworksCount > 0 ? totalWashEvents / activeNetworksCount : 0,
        avgWashesPerLocation: totalLocations > 0 ? totalWashEvents / totalLocations : 0,
      },
    };
  }

  // =========================================================================
  // AUDIT LOGS
  // =========================================================================

  async getPlatformAuditLogs(
    options: {
      action?: string;
      actorType?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: any[]; total: number }> {
    const where: any = {
      networkId: null, // Platform-level events have no networkId
    };

    if (options?.action) {
      where.action = options.action;
    }

    if (options?.actorType) {
      where.actorType = options.actorType;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: options?.limit || 100,
        skip: options?.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: data.map((log) => ({
        id: log.id,
        action: log.action,
        actorType: log.actorType,
        actorId: log.actorId,
        previousData: log.previousData,
        newData: log.newData,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),
      total,
    };
  }

  async getNetworkAuditLogs(
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

    return {
      data: data.map((log) => ({
        id: log.id,
        networkId: log.networkId,
        washEventId: log.washEventId,
        action: log.action,
        actorType: log.actorType,
        actorId: log.actorId,
        previousData: log.previousData,
        newData: log.newData,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        washEvent: log.washEvent,
      })),
      total,
    };
  }

  // =========================================================================
  // TEST EMAIL
  // =========================================================================

  async sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      return { success: false, message: 'SMTP nincs konfigurálva (SMTP_HOST, SMTP_USER, SMTP_PASS)' };
    }

    const nodemailer = await import('nodemailer');

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: '"Vemiax Info" <info@vemiax.com>',
        to,
        subject: 'Vemiax Platform - Teszt Email (info@vemiax.com)',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">Vemiax Platform</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
              <h2>Teszt email sikeres!</h2>
              <p>Ez egy teszt email az <strong>info@vemiax.com</strong> címről.</p>
              <p>Küldés időpontja: ${new Date().toLocaleString('hu-HU')}</p>
            </div>
          </div>
        `,
      });

      this.logger.log(`Test email sent from info@vemiax.com to ${to}: ${info.messageId}`);
      return { success: true, message: `Email sikeresen elküldve info@vemiax.com címről: ${to}` };
    } catch (error) {
      this.logger.error(`Test email error: ${error.message}`);
      return { success: false, message: `Hiba: ${error.message}` };
    }
  }

  async sendTestEmailsFromAll(to: string): Promise<{ results: Array<{ from: string; success: boolean; message: string }> }> {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      return {
        results: [{ from: 'all', success: false, message: 'SMTP nincs konfigurálva' }]
      };
    }

    const nodemailer = await import('nodemailer');
    const senders = [
      { email: 'info@vemiax.com', name: 'Vemiax Info' },
      { email: 'support@vemiax.com', name: 'Vemiax Support' },
      { email: 'noreply@vemiax.com', name: 'Vemiax' },
    ];

    const results: Array<{ from: string; success: boolean; message: string }> = [];

    for (const sender of senders) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const info = await transporter.sendMail({
          from: `"${sender.name}" <${sender.email}>`,
          to,
          subject: `Vemiax Platform - Teszt Email (${sender.email})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Vemiax Platform</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                <h2>Teszt email sikeres!</h2>
                <p>Ez egy teszt email a következő címről: <strong>${sender.email}</strong></p>
                <p>Feladó neve: ${sender.name}</p>
                <p>Küldés időpontja: ${new Date().toLocaleString('hu-HU')}</p>
              </div>
            </div>
          `,
        });

        this.logger.log(`Test email sent from ${sender.email} to ${to}: ${info.messageId}`);
        results.push({ from: sender.email, success: true, message: `Sikeres: ${info.messageId}` });

        // Wait 1 second between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.error(`Test email error from ${sender.email}: ${error.message}`);
        results.push({ from: sender.email, success: false, message: error.message });
      }
    }

    return { results };
  }

  // =========================================================================
  // NETWORK LOCATIONS (Platform Admin számára)
  // =========================================================================

  async listNetworkLocations(networkId: string): Promise<any[]> {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network || network.deletedAt) {
      throw new NotFoundException('Network nem található');
    }

    const locations = await this.prisma.location.findMany({
      where: { networkId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        city: true,
        zipCode: true,
        email: true,
        phone: true,
        operationType: true,
        isActive: true,
        // Alvállalkozói cégadatok
        subcontractorCompanyName: true,
        subcontractorTaxNumber: true,
        subcontractorAddress: true,
        subcontractorCity: true,
        subcontractorZipCode: true,
        subcontractorContactName: true,
        subcontractorContactPhone: true,
        subcontractorContactEmail: true,
        subcontractorBankAccount: true,
        _count: {
          select: {
            washEvents: true,
          },
        },
      },
    });

    return locations.map(loc => ({
      id: loc.id,
      name: loc.name,
      code: loc.code,
      address: loc.address,
      city: loc.city,
      zipCode: loc.zipCode,
      email: loc.email,
      phone: loc.phone,
      operationType: loc.operationType,
      isActive: loc.isActive,
      washEventCount: loc._count.washEvents,
      // Alvállalkozói cégadatok
      subcontractorCompanyName: loc.subcontractorCompanyName,
      subcontractorTaxNumber: loc.subcontractorTaxNumber,
      subcontractorAddress: loc.subcontractorAddress,
      subcontractorCity: loc.subcontractorCity,
      subcontractorZipCode: loc.subcontractorZipCode,
      subcontractorContactName: loc.subcontractorContactName,
      subcontractorContactPhone: loc.subcontractorContactPhone,
      subcontractorContactEmail: loc.subcontractorContactEmail,
      subcontractorBankAccount: loc.subcontractorBankAccount,
    }));
  }

  // =========================================================================
  // PLATFORM COMPANY DATA SETTINGS (Central service for Networks)
  // =========================================================================

  async getPlatformCompanyDataSettings(): Promise<any> {
    const settings = await this.prisma.platformSettings.findFirst();

    return {
      companyDataProvider: settings?.companyDataProvider || 'NONE',
      optenApiKey: settings?.optenApiKey ? '***' : '',
      optenApiSecret: settings?.optenApiSecret ? '***' : '',
      bisnodeApiKey: settings?.bisnodeApiKey ? '***' : '',
      bisnodeApiSecret: settings?.bisnodeApiSecret ? '***' : '',
      eCegjegyzekApiKey: settings?.eCegjegyzekApiKey ? '***' : '',
      companyDataMonthlyFee: settings?.companyDataMonthlyFee ? Number(settings.companyDataMonthlyFee) : null,
    };
  }

  async updatePlatformCompanyDataSettings(dto: {
    companyDataProvider: string;
    optenApiKey?: string;
    optenApiSecret?: string;
    bisnodeApiKey?: string;
    bisnodeApiSecret?: string;
    eCegjegyzekApiKey?: string;
    companyDataMonthlyFee?: number | null;
  }): Promise<any> {
    let settings = await this.prisma.platformSettings.findFirst();

    if (!settings) {
      settings = await this.prisma.platformSettings.create({
        data: { platformName: 'VSys Wash' },
      });
    }

    // Build update data - handle masked values (don't overwrite with '***')
    const updateData: any = {
      companyDataProvider: dto.companyDataProvider as CompanyDataProvider,
    };

    // Handle monthly fee
    if (dto.companyDataMonthlyFee !== undefined) {
      updateData.companyDataMonthlyFee = dto.companyDataMonthlyFee;
    }

    // Only update API keys if they're not masked
    if (dto.optenApiKey && dto.optenApiKey !== '***') {
      updateData.optenApiKey = dto.optenApiKey;
    }
    if (dto.optenApiSecret && dto.optenApiSecret !== '***') {
      updateData.optenApiSecret = dto.optenApiSecret;
    }
    if (dto.bisnodeApiKey && dto.bisnodeApiKey !== '***') {
      updateData.bisnodeApiKey = dto.bisnodeApiKey;
    }
    if (dto.bisnodeApiSecret && dto.bisnodeApiSecret !== '***') {
      updateData.bisnodeApiSecret = dto.bisnodeApiSecret;
    }
    if (dto.eCegjegyzekApiKey && dto.eCegjegyzekApiKey !== '***') {
      updateData.eCegjegyzekApiKey = dto.eCegjegyzekApiKey;
    }

    // Clear keys if provider is NONE
    if (dto.companyDataProvider === 'NONE') {
      updateData.optenApiKey = null;
      updateData.optenApiSecret = null;
      updateData.bisnodeApiKey = null;
      updateData.bisnodeApiSecret = null;
      updateData.eCegjegyzekApiKey = null;
    }

    // Clear non-relevant provider keys
    if (dto.companyDataProvider === 'OPTEN') {
      updateData.bisnodeApiKey = null;
      updateData.bisnodeApiSecret = null;
      updateData.eCegjegyzekApiKey = null;
    } else if (dto.companyDataProvider === 'BISNODE') {
      updateData.optenApiKey = null;
      updateData.optenApiSecret = null;
      updateData.eCegjegyzekApiKey = null;
    } else if (dto.companyDataProvider === 'E_CEGJEGYZEK') {
      updateData.optenApiKey = null;
      updateData.optenApiSecret = null;
      updateData.bisnodeApiKey = null;
      updateData.bisnodeApiSecret = null;
    }

    const updated = await this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: updateData,
    });

    return {
      companyDataProvider: updated.companyDataProvider,
      optenApiKey: updated.optenApiKey ? '***' : '',
      optenApiSecret: updated.optenApiSecret ? '***' : '',
      bisnodeApiKey: updated.bisnodeApiKey ? '***' : '',
      bisnodeApiSecret: updated.bisnodeApiSecret ? '***' : '',
      eCegjegyzekApiKey: updated.eCegjegyzekApiKey ? '***' : '',
      companyDataMonthlyFee: updated.companyDataMonthlyFee ? Number(updated.companyDataMonthlyFee) : null,
    };
  }

  // =========================================================================
  // NETWORK COMPANY DATA SETTINGS (Per-network overrides)
  // =========================================================================

  async getNetworkCompanyDataSettings(networkId: string): Promise<any> {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network || network.deletedAt) {
      throw new NotFoundException('Network nem található');
    }

    const settings = await this.prisma.networkSettings.findUnique({
      where: { networkId },
    });

    // Get platform settings to check if platform service is available
    const platformSettings = await this.prisma.platformSettings.findFirst();
    const platformHasService = platformSettings?.companyDataProvider !== 'NONE' &&
      (platformSettings?.optenApiKey || platformSettings?.bisnodeApiKey || platformSettings?.eCegjegyzekApiKey);

    return {
      // Network-level settings
      allowCustomCompanyDataProvider: settings?.allowCustomCompanyDataProvider ?? false,
      companyDataProvider: settings?.companyDataProvider || 'NONE',
      optenApiKey: settings?.optenApiKey ? '***' : '',
      optenApiSecret: settings?.optenApiSecret ? '***' : '',
      bisnodeApiKey: settings?.bisnodeApiKey ? '***' : '',
      bisnodeApiSecret: settings?.bisnodeApiSecret ? '***' : '',
      eCegjegyzekApiKey: settings?.eCegjegyzekApiKey ? '***' : '',
      // Platform service info
      platformHasService: !!platformHasService,
      platformServiceProvider: platformSettings?.companyDataProvider || 'NONE',
      platformServiceMonthlyFee: platformSettings?.companyDataMonthlyFee
        ? Number(platformSettings.companyDataMonthlyFee)
        : null,
    };
  }

  async updateNetworkCompanyDataSettings(
    networkId: string,
    dto: {
      allowCustomCompanyDataProvider?: boolean;
      companyDataProvider?: string;
      optenApiKey?: string;
      optenApiSecret?: string;
      bisnodeApiKey?: string;
      bisnodeApiSecret?: string;
      eCegjegyzekApiKey?: string;
    },
  ): Promise<any> {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network || network.deletedAt) {
      throw new NotFoundException('Network nem található');
    }

    // Ensure settings exist
    let settings = await this.prisma.networkSettings.findUnique({
      where: { networkId },
    });

    if (!settings) {
      settings = await this.prisma.networkSettings.create({
        data: { networkId },
      });
    }

    // Build update data
    const updateData: any = {};

    // Handle allowCustomCompanyDataProvider flag
    if (dto.allowCustomCompanyDataProvider !== undefined) {
      updateData.allowCustomCompanyDataProvider = dto.allowCustomCompanyDataProvider;
    }

    // Handle provider and keys (only if custom provider is allowed)
    if (dto.companyDataProvider !== undefined) {
      updateData.companyDataProvider = dto.companyDataProvider as CompanyDataProvider;
    }

    // Only update API keys if they're not masked
    if (dto.optenApiKey && dto.optenApiKey !== '***') {
      updateData.optenApiKey = dto.optenApiKey;
    }
    if (dto.optenApiSecret && dto.optenApiSecret !== '***') {
      updateData.optenApiSecret = dto.optenApiSecret;
    }
    if (dto.bisnodeApiKey && dto.bisnodeApiKey !== '***') {
      updateData.bisnodeApiKey = dto.bisnodeApiKey;
    }
    if (dto.bisnodeApiSecret && dto.bisnodeApiSecret !== '***') {
      updateData.bisnodeApiSecret = dto.bisnodeApiSecret;
    }
    if (dto.eCegjegyzekApiKey && dto.eCegjegyzekApiKey !== '***') {
      updateData.eCegjegyzekApiKey = dto.eCegjegyzekApiKey;
    }

    // Clear keys if provider is NONE
    if (dto.companyDataProvider === 'NONE') {
      updateData.optenApiKey = null;
      updateData.optenApiSecret = null;
      updateData.bisnodeApiKey = null;
      updateData.bisnodeApiSecret = null;
      updateData.eCegjegyzekApiKey = null;
    }

    // Clear non-relevant provider keys
    if (dto.companyDataProvider === 'OPTEN') {
      updateData.bisnodeApiKey = null;
      updateData.bisnodeApiSecret = null;
      updateData.eCegjegyzekApiKey = null;
    } else if (dto.companyDataProvider === 'BISNODE') {
      updateData.optenApiKey = null;
      updateData.optenApiSecret = null;
      updateData.eCegjegyzekApiKey = null;
    } else if (dto.companyDataProvider === 'E_CEGJEGYZEK') {
      updateData.optenApiKey = null;
      updateData.optenApiSecret = null;
      updateData.bisnodeApiKey = null;
      updateData.bisnodeApiSecret = null;
    }

    const updated = await this.prisma.networkSettings.update({
      where: { networkId },
      data: updateData,
    });

    // Get platform settings for response
    const platformSettings = await this.prisma.platformSettings.findFirst();
    const platformHasService = platformSettings?.companyDataProvider !== 'NONE' &&
      (platformSettings?.optenApiKey || platformSettings?.bisnodeApiKey || platformSettings?.eCegjegyzekApiKey);

    return {
      allowCustomCompanyDataProvider: updated.allowCustomCompanyDataProvider,
      companyDataProvider: updated.companyDataProvider,
      optenApiKey: updated.optenApiKey ? '***' : '',
      optenApiSecret: updated.optenApiSecret ? '***' : '',
      bisnodeApiKey: updated.bisnodeApiKey ? '***' : '',
      bisnodeApiSecret: updated.bisnodeApiSecret ? '***' : '',
      eCegjegyzekApiKey: updated.eCegjegyzekApiKey ? '***' : '',
      platformHasService: !!platformHasService,
      platformServiceProvider: platformSettings?.companyDataProvider || 'NONE',
      platformServiceMonthlyFee: platformSettings?.companyDataMonthlyFee
        ? Number(platformSettings.companyDataMonthlyFee)
        : null,
    };
  }

  // =========================================================================
  // TRIAL EXTENSION NOTIFICATION
  // =========================================================================

  private async notifyNetworkAdminTrialExtended(
    networkId: string,
    networkName: string,
    oldTrialEndsAt: Date | null,
    newTrialEndsAt: Date,
  ): Promise<void> {
    try {
      // Find network admin(s)
      const networkAdmins = await this.prisma.networkAdmin.findMany({
        where: {
          networkId,
          isActive: true,
          deletedAt: null,
        },
        select: {
          email: true,
          name: true,
        },
      });

      if (networkAdmins.length === 0) {
        this.logger.warn(`No network admins found for network ${networkId} to notify about trial extension`);
        return;
      }

      const formatDate = (date: Date) => date.toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const newEndDateStr = formatDate(newTrialEndsAt);
      const oldEndDateStr = oldTrialEndsAt ? formatDate(oldTrialEndsAt) : 'nincs beállítva';

      // Calculate days added
      let daysAdded = '';
      if (oldTrialEndsAt) {
        const diffMs = newTrialEndsAt.getTime() - oldTrialEndsAt.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          daysAdded = `(+${diffDays} nap)`;
        }
      }

      for (const admin of networkAdmins) {
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .highlight { background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 5px 5px 0; }
    .date-box { display: inline-block; background: #10b981; color: white; padding: 10px 20px; border-radius: 5px; font-size: 18px; font-weight: bold; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🎉 Próbaidőszak meghosszabbítva!</h1>
    </div>
    <div class="content">
      <p>Kedves ${admin.name || 'Adminisztrátor'}!</p>

      <p>Örömmel értesítjük, hogy a <strong>${networkName}</strong> hálózat próbaidőszaka meghosszabbításra került.</p>

      <div class="highlight">
        <p style="margin: 0 0 10px 0;"><strong>Korábbi lejárat:</strong> ${oldEndDateStr}</p>
        <p style="margin: 0;"><strong>Új lejárat:</strong></p>
        <div class="date-box">${newEndDateStr} ${daysAdded}</div>
      </div>

      <p>A meghosszabbítás azonnali hatállyal érvényes. A rendszer minden funkciója továbbra is korlátozás nélkül elérhető.</p>

      <p>Ha bármilyen kérdése van, kérjük vegye fel velünk a kapcsolatot!</p>

      <p>Üdvözlettel,<br>A VSys Platform csapata</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} VSys Platform</p>
    </div>
  </div>
</body>
</html>
        `;

        const text = `
Kedves ${admin.name || 'Adminisztrátor'}!

Örömmel értesítjük, hogy a ${networkName} hálózat próbaidőszaka meghosszabbításra került.

Korábbi lejárat: ${oldEndDateStr}
Új lejárat: ${newEndDateStr} ${daysAdded}

A meghosszabbítás azonnali hatállyal érvényes. A rendszer minden funkciója továbbra is korlátozás nélkül elérhető.

Ha bármilyen kérdése van, kérjük vegye fel velünk a kapcsolatot!

Üdvözlettel,
A VSys Platform csapata

© ${new Date().getFullYear()} VSys Platform
        `;

        await this.emailService.sendEmail({
          to: admin.email,
          subject: `VSys - Próbaidőszak meghosszabbítva: ${networkName}`,
          html,
          text,
        });

        this.logger.log(`Trial extension notification sent to ${admin.email} for network ${networkName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send trial extension notification: ${error.message}`, error.stack);
      // Don't throw - notification failure shouldn't break the update
    }
  }
}
