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
import { EmailService } from '../modules/email/email.service';
import { AccountLockoutService } from '../common/security/account-lockout.service';
import { RefreshTokenService } from '../common/auth/refresh-token.service';
import { assertValidPassword } from '../common/security/password-policy';
import { SubscriptionStatus, AuditAction, RefreshTokenType } from '@prisma/client';
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

  async login(dto: NetworkAdminLoginDto, ipAddress?: string, userAgent?: string): Promise<NetworkAdminLoginResponseDto> {
    const email = dto.email.toLowerCase();
    const slug = dto.slug.toLowerCase();
    const lockKey = `${slug}:${email}`; // Lock per network+email combination

    // SECURITY: Check if account is locked
    const lockStatus = this.lockoutService.isLocked(lockKey);
    if (lockStatus.isLocked) {
      await this.auditLogService.log({
        action: AuditAction.LOGIN_FAILED,
        actorType: 'NETWORK_ADMIN',
        metadata: { slug, email, error: 'Account locked', remainingSeconds: lockStatus.remainingSeconds },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException(
        `Fiók ideiglenesen zárolva. Próbálja újra ${Math.ceil((lockStatus.remainingSeconds || 0) / 60)} perc múlva.`
      );
    }

    // Find network by slug
    const network = await this.prisma.network.findUnique({
      where: { slug },
    });

    if (!network || network.deletedAt || !network.isActive) {
      // SECURITY: Record failed attempt
      const lockResult = this.lockoutService.recordFailedAttempt(lockKey);

      // AUDIT: Log failed login - network not found
      await this.auditLogService.log({
        action: AuditAction.LOGIN_FAILED,
        actorType: 'NETWORK_ADMIN',
        metadata: {
          slug,
          email,
          error: 'Network not found or inactive',
          attemptsRemaining: lockResult.attemptsRemaining,
          isNowLocked: lockResult.isNowLocked,
        },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Hálózat nem található vagy inaktív');
    }

    // Find admin
    const admin = await this.prisma.networkAdmin.findFirst({
      where: {
        networkId: network.id,
        email,
        deletedAt: null,
      },
    });

    if (!admin || !admin.isActive) {
      // SECURITY: Record failed attempt
      const lockResult = this.lockoutService.recordFailedAttempt(lockKey);

      // AUDIT: Log failed login - admin not found
      await this.auditLogService.log({
        networkId: network.id,
        action: AuditAction.LOGIN_FAILED,
        actorType: 'NETWORK_ADMIN',
        metadata: {
          slug,
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
      const lockResult = this.lockoutService.recordFailedAttempt(lockKey);

      // AUDIT: Log failed login - invalid password
      await this.auditLogService.log({
        networkId: network.id,
        action: AuditAction.LOGIN_FAILED,
        actorType: 'NETWORK_ADMIN',
        actorId: admin.id,
        metadata: {
          slug,
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

    // Check email verification
    if (!admin.emailVerified) {
      // AUDIT: Log failed login - email not verified (no lockout for this)
      await this.auditLogService.log({
        networkId: network.id,
        action: AuditAction.LOGIN_FAILED,
        actorType: 'NETWORK_ADMIN',
        actorId: admin.id,
        metadata: { slug, email, error: 'Email not verified' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('EMAIL_NOT_VERIFIED');
    }

    // SECURITY: Clear failed attempts on successful login
    this.lockoutService.clearFailedAttempts(lockKey);

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
      type: 'network' as const,
    };

    // SECURITY: Generate token pair with refresh token
    const tokenPair = await this.refreshTokenService.createTokenPair(
      payload,
      RefreshTokenType.NETWORK_ADMIN,
      { userAgent, ipAddress },
    );

    // AUDIT: Log successful login
    await this.auditLogService.log({
      networkId: network.id,
      action: AuditAction.LOGIN_SUCCESS,
      actorType: 'NETWORK_ADMIN',
      actorId: admin.id,
      metadata: { slug: dto.slug.toLowerCase(), email: dto.email.toLowerCase(), role: admin.role },
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
        secret: this.getJwtSecret(),
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
    return this.refreshTokenService.revokeAllUserTokens(adminId, RefreshTokenType.NETWORK_ADMIN);
  }

  // =========================================================================
  // REGISTRATION
  // =========================================================================

  async register(dto: NetworkRegisterDto): Promise<NetworkRegisterResponseDto> {
    // Check if slug is already taken (only active networks)
    const existingNetwork = await this.prisma.network.findFirst({
      where: {
        slug: dto.slug.toLowerCase(),
        deletedAt: null, // Allow re-registration after soft delete
      },
    });

    if (existingNetwork) {
      throw new ConflictException('Ez a hálózat azonosító már foglalt');
    }

    // Check if email is already used anywhere (only active admins)
    const existingAdmin = await this.prisma.networkAdmin.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        deletedAt: null, // Allow re-registration after soft delete
      },
    });

    if (existingAdmin) {
      throw new ConflictException('Ez az email cím már regisztrálva van');
    }

    // SECURITY: Validate password strength BEFORE creating anything
    assertValidPassword(dto.password);

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

    // Hash password and create admin (password already validated above)
    const passwordHash = await bcrypt.hash(dto.password, 12);
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

    // Send welcome email to new network admin with verification link
    await this.sendNetworkWelcomeEmail(admin, network, verificationToken);

    // Send notification to platform admin
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

    // Mark admin email as verified
    if (verificationToken.networkAdminId) {
      await this.prisma.networkAdmin.update({
        where: { id: verificationToken.networkAdminId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
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

    // Send verification email
    await this.sendVerificationEmail(admin, network, verificationToken);

    return {
      success: true,
      message: 'Új megerősítő email elküldve.',
    };
  }

  private async sendVerificationEmail(
    admin: any,
    network: any,
    verificationToken: string,
  ): Promise<void> {
    const apiUrl = this.configService.get<string>('API_URL') || 'https://api.vemiax.com';
    const verifyUrl = `${apiUrl}/network-admin/verify-email?token=${verificationToken}`;

    const text = `Kedves ${admin.name}!

Kérjük, erősítse meg email címét az alábbi linkre kattintva:

${verifyUrl}

A link 24 órán belül lejár.

Hálózat: ${network.name} (${network.slug})

Üdvözlettel,
Vemiax csapata`;

    try {
      await this.emailService.sendEmail({
        to: admin.email,
        subject: 'Email cím megerősítése - Vemiax',
        html: text.replace(/\n/g, '<br>'),
        text,
      });
      this.logger.log(`Verification email sent to ${admin.email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email: ${error.message}`);
      throw error;
    }
  }

  // =========================================================================
  // PASSWORD RESET
  // =========================================================================

  async forgotPassword(email: string, slug: string): Promise<{ success: boolean; message: string }> {
    // Always return success to prevent email enumeration attacks
    const successResponse = {
      success: true,
      message: 'Ha a megadott email cím létezik a rendszerben, elküldtük a jelszó visszaállító linket.',
    };

    try {
      const network = await this.prisma.network.findUnique({
        where: { slug: slug.toLowerCase() },
      });

      if (!network) {
        return successResponse;
      }

      const admin = await this.prisma.networkAdmin.findFirst({
        where: {
          networkId: network.id,
          email: email.toLowerCase(),
          deletedAt: null,
        },
      });

      if (!admin) {
        return successResponse;
      }

      // Invalidate old password reset tokens
      await this.prisma.verificationToken.updateMany({
        where: {
          networkAdminId: admin.id,
          type: 'PASSWORD_RESET',
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      // Generate new token
      const resetToken = crypto.randomBytes(32).toString('hex');
      await this.prisma.verificationToken.create({
        data: {
          token: resetToken,
          type: 'PASSWORD_RESET',
          email: email.toLowerCase(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
          networkAdminId: admin.id,
        },
      });

      // Send password reset email
      await this.sendPasswordResetEmail(admin, network, resetToken);

      return successResponse;
    } catch (error) {
      this.logger.error(`Error in forgotPassword: ${error.message}`);
      return successResponse;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const resetToken = await this.prisma.verificationToken.findFirst({
      where: {
        token,
        type: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Érvénytelen vagy lejárt token. Kérjen új jelszó visszaállító linket.');
    }

    // Mark token as used
    await this.prisma.verificationToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    // SECURITY: Validate password strength
    assertValidPassword(newPassword);

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.networkAdmin.update({
      where: { id: resetToken.networkAdminId! },
      data: { passwordHash },
    });

    this.logger.log(`Password reset successful for admin ${resetToken.networkAdminId}`);

    return {
      success: true,
      message: 'Jelszó sikeresen megváltoztatva. Most már bejelentkezhet az új jelszóval.',
    };
  }

  private async sendPasswordResetEmail(
    admin: any,
    network: any,
    resetToken: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.vemiax.com';
    const resetUrl = `${frontendUrl}/network-admin/reset-password?token=${resetToken}&slug=${network.slug}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Vemiax</h1>
      <p>Jelszó visszaállítás</p>
    </div>
    <div class="content">
      <h2>Kedves ${admin.name}!</h2>
      <p>Jelszó visszaállítási kérelmet kaptunk a(z) <strong>${network.name}</strong> hálózathoz tartozó fiókodhoz.</p>
      <p>Kattints az alábbi gombra az új jelszó beállításához:</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Új jelszó beállítása</a>
      </p>
      <div class="warning">
        <strong>Fontos!</strong> A link 1 órán belül lejár. Ha nem te kérted a jelszó visszaállítást, hagyd figyelmen kívül ezt az emailt.
      </div>
      <p>Ha a gomb nem működik, másold be ezt a linket a böngésződbe:</p>
      <p style="word-break: break-all; color: #6b7280; font-size: 12px;">${resetUrl}</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Vemiax. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Kedves ${admin.name}!

Jelszó visszaállítási kérelmet kaptunk a(z) ${network.name} hálózathoz tartozó fiókodhoz.

Az új jelszó beállításához kattints erre a linkre:
${resetUrl}

A link 1 órán belül lejár.

Ha nem te kérted a jelszó visszaállítást, hagyd figyelmen kívül ezt az emailt.

© ${new Date().getFullYear()} Vemiax
    `;

    try {
      await this.emailService.sendEmail({
        to: admin.email,
        subject: 'Jelszó visszaállítás - Vemiax',
        html,
        text,
      });
      this.logger.log(`Password reset email sent to ${admin.email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${error.message}`);
      throw error;
    }
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

    // Log the registration
    this.logger.log(`
      [NEW NETWORK REGISTRATION]
      Network: ${network.name} (${network.slug})
      Admin: ${admin.name} <${admin.email}>
      Phone: ${dto.phone}
      Company: ${dto.taxNumber || 'N/A'}
      Trial ends: ${network.trialEndsAt}
    `);

    // Send email to platform admin (info@vemiax.com)
    const platformEmail = platformSettings?.supportEmail || 'info@vemiax.com';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .label { color: #6b7280; font-size: 12px; text-transform: uppercase; }
    .value { font-weight: bold; font-size: 16px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Vemiax Platform</h1>
      <p>Új hálózat regisztrált!</p>
    </div>
    <div class="content">
      <h2>Új hálózat regisztráció</h2>

      <div class="info-box">
        <div class="label">Hálózat neve</div>
        <div class="value">${network.name}</div>
      </div>

      <div class="info-box">
        <div class="label">Azonosító (slug)</div>
        <div class="value">${network.slug}</div>
      </div>

      <div class="info-box">
        <div class="label">Admin neve</div>
        <div class="value">${admin.name}</div>
      </div>

      <div class="info-box">
        <div class="label">Admin email</div>
        <div class="value">${admin.email}</div>
      </div>

      <div class="info-box">
        <div class="label">Telefonszám</div>
        <div class="value">${dto.phone}</div>
      </div>

      ${dto.taxNumber ? `
      <div class="info-box">
        <div class="label">Adószám</div>
        <div class="value">${dto.taxNumber}</div>
      </div>
      ` : ''}

      <div class="info-box">
        <div class="label">Próbaidőszak lejár</div>
        <div class="value">${new Date(network.trialEndsAt).toLocaleDateString('hu-HU')}</div>
      </div>

      <div class="info-box">
        <div class="label">Regisztráció időpontja</div>
        <div class="value">${new Date().toLocaleString('hu-HU')}</div>
      </div>

      <p style="margin-top: 20px;">
        <a href="https://app.vemiax.com/platform-admin/networks"
           style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Hálózatok megtekintése
        </a>
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Vemiax Platform. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      await this.emailService.sendEmail({
        to: platformEmail,
        subject: `Új hálózat regisztrált: ${network.name}`,
        html,
        text: `Új hálózat regisztrált!\n\nHálózat: ${network.name} (${network.slug})\nAdmin: ${admin.name} <${admin.email}>\nTelefon: ${dto.phone}\nPróbaidőszak lejár: ${new Date(network.trialEndsAt).toLocaleDateString('hu-HU')}`,
      });
      this.logger.log(`Platform notification email sent to ${platformEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send platform notification email: ${error.message}`);
    }
  }

  private async sendNetworkWelcomeEmail(
    admin: any,
    network: any,
    verificationToken: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.vemiax.com';
    const apiUrl = this.configService.get<string>('API_URL') || 'https://api.vemiax.com';
    const verifyUrl = `${apiUrl}/network-admin/verify-email?token=${verificationToken}`;
    const trialEndDate = network.trialEndsAt ? new Date(network.trialEndsAt).toLocaleDateString('hu-HU') : 'N/A';

    const text = `Kedves ${admin.name}!

Köszönjük, hogy regisztrált a Vemiax - VSys Wash rendszerbe!

Az Ön hálózata sikeresen létrejött.

Hálózat neve: ${network.name}
Hálózat azonosító: ${network.slug}
Bejelentkezési email: ${admin.email}
Próbaidőszak vége: ${trialEndDate}

FONTOS: Kérjük, erősítse meg email címét az alábbi linkre kattintva:
${verifyUrl}

A link 24 órán belül lejár.

Következő lépések:
1. Erősítse meg az email címét (fenti link)
2. Jelentkezzen be a rendszerbe: ${frontendUrl}/network-admin
3. Hozza létre az első mosóhelyszínt
4. Adjon hozzá partner cégeket és sofőröket

Ha kérdése van, írjon nekünk: info@vemiax.com

Üdvözlettel,
Vemiax csapata`;

    try {
      await this.emailService.sendEmail({
        to: admin.email,
        subject: 'Üdvözöljük a Vemiax rendszerben - Email megerősítés szükséges',
        html: text.replace(/\n/g, '<br>'),
        text,
      });
      this.logger.log(`Welcome email sent to ${admin.email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email: ${error.message}`);
    }
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
      locationType: l.locationType || 'TRUCK_WASH',
      operatorCount: 0, // operators reláció nem létezik
      washEventCount: l._count?.washEvents || 0,
      visibility: l.visibility || 'NETWORK_ONLY',
      dedicatedPartnerIds: l.dedicatedPartnerIds || [],
    }));
  }

  async createLocation(networkId: string, dto: CreateLocationDto): Promise<LocationListItemDto> {
    // Get network to inherit country and timezone
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
      select: { country: true, timezone: true },
    });

    if (!network) {
      throw new NotFoundException('Hálózat nem található');
    }

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
        // Location inherits country and timezone from Network
        country: network.country,
        timezone: network.timezone,
        latitude: dto.latitude,
        longitude: dto.longitude,
        openingHours: dto.openingHours,
        phone: dto.phone,
        email: dto.email,
        operationType: dto.operationType || 'OWN',
        locationType: dto.locationType || 'CAR_WASH',
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

    // Send notification emails
    await this.sendLocationCreatedNotification(networkId, location);

    return {
      id: location.id,
      name: location.name,
      address: location.address || '',
      city: location.city || '',
      isActive: location.isActive,
      locationType: location.locationType || 'CAR_WASH',
      operatorCount: 0,
      washEventCount: (location as any)._count?.washEvents || 0,
    };
  }

  private async sendLocationCreatedNotification(networkId: string, location: any): Promise<void> {
    try {
      // Get network details with admin email
      const network = await this.prisma.network.findUnique({
        where: { id: networkId },
        include: {
          networkAdmins: {
            where: { isActive: true },
            select: { email: true, name: true },
          },
        },
      });

      if (!network) return;

      const adminEmails = network.networkAdmins.map((a: { email: string }) => a.email).filter(Boolean);
      const locationEmails = location.email ? [location.email] : [];

      const allRecipients = [...new Set([...adminEmails, ...locationEmails])];

      if (allRecipients.length === 0) {
        this.logger.warn(`No recipients for location created notification (network: ${networkId})`);
        return;
      }

      const operationType = location.operationType === 'OWN' ? 'Saját üzemeltetés' : 'Alvállalkozó';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Új helyszín létrehozva</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937;">${location.name}</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Helyszín kód:</td>
                <td style="padding: 8px 0; font-weight: bold;">${location.code}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Cím:</td>
                <td style="padding: 8px 0;">${location.address || '-'}, ${location.zipCode || ''} ${location.city || ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Üzemeltetés típusa:</td>
                <td style="padding: 8px 0;">${operationType}</td>
              </tr>
              ${location.phone ? `<tr><td style="padding: 8px 0; color: #6b7280;">Telefon:</td><td style="padding: 8px 0;">${location.phone}</td></tr>` : ''}
              ${location.email ? `<tr><td style="padding: 8px 0; color: #6b7280;">Email:</td><td style="padding: 8px 0;">${location.email}</td></tr>` : ''}
            </table>
            <div style="margin-top: 20px; padding: 15px; background: #dbeafe; border-radius: 8px;">
              <p style="margin: 0; color: #1e40af; font-size: 14px;">
                <strong>Következő lépések:</strong><br>
                1. Adj hozzá operátorokat a helyszínhez<br>
                2. Állítsd be az elérhető szolgáltatásokat<br>
                3. Generálj QR kódot a helyszínnek
              </p>
            </div>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
              Létrehozva: ${new Date().toLocaleString('hu-HU')}
            </p>
          </div>
        </div>
      `;

      await this.emailService.sendNetworkEmail(networkId, {
        to: allRecipients,
        subject: `Új helyszín létrehozva: ${location.name}`,
        html,
      });

      this.logger.log(`Location created notification sent to ${allRecipients.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to send location created notification: ${error.message}`);
      // Don't throw - notification failure shouldn't break location creation
    }
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
    // Note: country and timezone are inherited from Network, not editable on Location level
    if (dto.latitude !== undefined) updateData.latitude = dto.latitude;
    if (dto.longitude !== undefined) updateData.longitude = dto.longitude;
    if (dto.openingHours !== undefined) updateData.openingHours = dto.openingHours;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.operationType !== undefined) updateData.operationType = dto.operationType;
    // Alvállalkozói cégadatok
    if (dto.subcontractorCompanyName !== undefined) updateData.subcontractorCompanyName = dto.subcontractorCompanyName;
    if (dto.subcontractorTaxNumber !== undefined) updateData.subcontractorTaxNumber = dto.subcontractorTaxNumber;
    if (dto.subcontractorAddress !== undefined) updateData.subcontractorAddress = dto.subcontractorAddress;
    if (dto.subcontractorCity !== undefined) updateData.subcontractorCity = dto.subcontractorCity;
    if (dto.subcontractorZipCode !== undefined) updateData.subcontractorZipCode = dto.subcontractorZipCode;
    if (dto.subcontractorContactName !== undefined) updateData.subcontractorContactName = dto.subcontractorContactName;
    if (dto.subcontractorContactPhone !== undefined) updateData.subcontractorContactPhone = dto.subcontractorContactPhone;
    if (dto.subcontractorContactEmail !== undefined) updateData.subcontractorContactEmail = dto.subcontractorContactEmail;
    if (dto.subcontractorBankAccount !== undefined) updateData.subcontractorBankAccount = dto.subcontractorBankAccount;
    if (dto.locationType !== undefined) updateData.locationType = dto.locationType;
    // Visibility beállítások
    if (dto.visibility !== undefined) updateData.visibility = dto.visibility;
    if (dto.dedicatedPartnerIds !== undefined) {
      // Ha nem DEDICATED, ürítsük a partner listát
      if (dto.visibility !== undefined && dto.visibility !== 'DEDICATED') {
        updateData.dedicatedPartnerIds = [];
      } else {
        updateData.dedicatedPartnerIds = dto.dedicatedPartnerIds;
      }
    }

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
      locationType: updated.locationType || 'TRUCK_WASH',
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
        billingCountry: dto.billingCountry || 'HU',
        euVatNumber: dto.euVatNumber,
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

    // Get platform settings to check if platform service is available
    const platformSettings = await this.prisma.platformSettings.findFirst();
    const platformHasService =
      platformSettings?.companyDataProvider !== 'NONE' &&
      (platformSettings?.optenApiKey || platformSettings?.bisnodeApiKey);

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
        billingoBankAccountId: settings?.billingoBankAccountId || null,
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
      // Cégadatbázis szolgáltató
      companyData: {
        companyDataProvider: settings?.companyDataProvider || 'NONE',
        optenApiKey: settings?.optenApiKey ? '***' : '',
        optenApiSecret: settings?.optenApiSecret ? '***' : '',
        bisnodeApiKey: settings?.bisnodeApiKey ? '***' : '',
        bisnodeApiSecret: settings?.bisnodeApiSecret ? '***' : '',
        // Platform service info (for UI to know what to show)
        allowCustomCompanyDataProvider: settings?.allowCustomCompanyDataProvider ?? false,
        platformHasService: !!platformHasService,
        platformServiceProvider: platformSettings?.companyDataProvider || 'NONE',
        platformServiceMonthlyFee: platformSettings?.companyDataMonthlyFee
          ? Number(platformSettings.companyDataMonthlyFee)
          : null,
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
      if (dto.invoicing.billingoBankAccountId !== undefined) {
        settingsData.billingoBankAccountId = dto.invoicing.billingoBankAccountId;
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

    // Cégadatbázis szolgáltató
    if (dto.companyData) {
      Object.assign(settingsData, {
        companyDataProvider: dto.companyData.companyDataProvider,
      });
      // Csak nem maszkolt értékeket frissítünk
      if (dto.companyData.optenApiKey && dto.companyData.optenApiKey !== '***') {
        settingsData.optenApiKey = dto.companyData.optenApiKey;
      }
      if (dto.companyData.optenApiSecret && dto.companyData.optenApiSecret !== '***') {
        settingsData.optenApiSecret = dto.companyData.optenApiSecret;
      }
      if (dto.companyData.bisnodeApiKey && dto.companyData.bisnodeApiKey !== '***') {
        settingsData.bisnodeApiKey = dto.companyData.bisnodeApiKey;
      }
      if (dto.companyData.bisnodeApiSecret && dto.companyData.bisnodeApiSecret !== '***') {
        settingsData.bisnodeApiSecret = dto.companyData.bisnodeApiSecret;
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

  async testEmailConfig(networkId: string, testEmail: string): Promise<{ success: boolean; message: string; provider?: string }> {
    return this.emailService.testNetworkEmailConfig(networkId, testEmail);
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
    const pinHash = await bcrypt.hash(dto.pin, 12);

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
      updateData.pinHash = await bcrypt.hash(dto.pin, 12);
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

  // =========================================================================
  // INVOICES
  // =========================================================================

  async listInvoices(
    networkId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      status?: string;
      partnerCompanyId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: any[]; total: number }> {
    const where: any = { networkId };

    if (options.startDate || options.endDate) {
      where.issueDate = {};
      if (options.startDate) where.issueDate.gte = options.startDate;
      if (options.endDate) where.issueDate.lte = options.endDate;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.partnerCompanyId) {
      where.partnerCompanyId = options.partnerCompanyId;
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          partnerCompany: {
            select: { id: true, name: true, code: true },
          },
          items: true,
        },
        orderBy: { issueDate: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: data.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        paidDate: inv.paidDate,
        subtotal: Number(inv.subtotal),
        vatAmount: Number(inv.vatAmount),
        total: Number(inv.total),
        currency: inv.currency,
        paymentMethod: inv.paymentMethod,
        partnerCompany: inv.partnerCompany,
        itemCount: inv.items.length,
        externalId: inv.externalId,
        pdfUrl: inv.szamlazzPdfUrl,
      })),
      total,
    };
  }

  async getInvoiceSummary(
    networkId: string,
    options: { startDate?: Date; endDate?: Date },
  ): Promise<any> {
    const where: any = { networkId };

    if (options.startDate || options.endDate) {
      where.issueDate = {};
      if (options.startDate) where.issueDate.gte = options.startDate;
      if (options.endDate) where.issueDate.lte = options.endDate;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      select: { status: true, total: true },
    });

    const summary = {
      totalCount: invoices.length,
      totalAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      overdueAmount: 0,
      draftAmount: 0,
      byStatus: {} as Record<string, { count: number; amount: number }>,
    };

    invoices.forEach((inv) => {
      const amount = Number(inv.total);
      summary.totalAmount += amount;

      if (!summary.byStatus[inv.status]) {
        summary.byStatus[inv.status] = { count: 0, amount: 0 };
      }
      summary.byStatus[inv.status].count += 1;
      summary.byStatus[inv.status].amount += amount;

      switch (inv.status) {
        case 'PAID':
          summary.paidAmount += amount;
          break;
        case 'OVERDUE':
          summary.overdueAmount += amount;
          summary.unpaidAmount += amount;
          break;
        case 'ISSUED':
        case 'SENT':
          summary.unpaidAmount += amount;
          break;
        case 'DRAFT':
          summary.draftAmount += amount;
          break;
      }
    });

    return summary;
  }

  async getInvoice(networkId: string, invoiceId: string): Promise<any> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, networkId },
      include: {
        partnerCompany: true,
        items: true,
        washEvents: {
          select: {
            id: true,
            status: true,
            tractorPlateManual: true,
            createdAt: true,
            totalPrice: true,
            location: { select: { name: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Számla nem található');
    }

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      paidDate: invoice.paidDate,
      subtotal: Number(invoice.subtotal),
      vatAmount: Number(invoice.vatAmount),
      total: Number(invoice.total),
      currency: invoice.currency,
      paymentMethod: invoice.paymentMethod,
      externalId: invoice.externalId,
      pdfUrl: invoice.szamlazzPdfUrl,
      partnerCompany: invoice.partnerCompany ? {
        id: invoice.partnerCompany.id,
        name: invoice.partnerCompany.name,
        code: invoice.partnerCompany.code,
        taxNumber: invoice.partnerCompany.taxNumber,
        billingAddress: invoice.partnerCompany.billingAddress,
        email: invoice.partnerCompany.email,
      } : null,
      // Include billing info from invoice for private customers
      billingName: invoice.billingName,
      billingAddress: invoice.billingAddress,
      billingCity: invoice.billingCity,
      billingZipCode: invoice.billingZipCode,
      taxNumber: invoice.taxNumber,
      items: invoice.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        vatRate: item.vatRate,
      })),
      washEvents: invoice.washEvents.map((e) => ({
        id: e.id,
        status: e.status,
        tractorPlate: e.tractorPlateManual,
        locationName: e.location?.name,
        createdAt: e.createdAt,
        totalPrice: Number(e.totalPrice),
      })),
    };
  }

  async prepareInvoice(
    networkId: string,
    dto: {
      partnerCompanyId: string;
      startDate: Date;
      endDate: Date;
      paymentMethod?: string;
      dueDays?: number;
    },
  ): Promise<any> {
    // Verify partner company exists
    const partner = await this.prisma.partnerCompany.findFirst({
      where: { id: dto.partnerCompanyId, networkId, deletedAt: null },
    });

    if (!partner) {
      throw new NotFoundException('Partner cég nem található');
    }

    // Get unbilled wash events for this period
    const washEvents = await this.prisma.washEvent.findMany({
      where: {
        networkId,
        partnerCompanyId: dto.partnerCompanyId,
        status: 'COMPLETED',
        invoiceId: null,
        createdAt: {
          gte: dto.startDate,
          lte: dto.endDate,
        },
      },
      include: {
        services: { include: { servicePackage: true } },
        location: true,
      },
    });

    if (washEvents.length === 0) {
      throw new BadRequestException('Nincs számlázatlan mosás ebben az időszakban');
    }

    // Get default VAT rate
    const vatRate = await this.prisma.networkVatRate.findFirst({
      where: { networkId, isDefault: true, isActive: true },
    });
    const vatPercent = vatRate?.rate || 27;

    // Calculate totals and create items
    let subtotal = 0;
    const itemsData: any[] = [];

    // Group by service for cleaner invoice
    const serviceGroups: Record<string, { name: string; quantity: number; unitPrice: number; total: number }> = {};

    for (const event of washEvents) {
      for (const service of event.services) {
        const serviceName = service.servicePackage?.name || 'Szolgáltatás';
        const price = Number(service.totalPrice || 0);

        if (!serviceGroups[serviceName]) {
          serviceGroups[serviceName] = { name: serviceName, quantity: 0, unitPrice: price, total: 0 };
        }
        serviceGroups[serviceName].quantity += 1;
        serviceGroups[serviceName].total += price;
      }

      // If no services but has total price
      if (event.services.length === 0 && event.totalPrice) {
        const price = Number(event.totalPrice);
        if (!serviceGroups['Mosás']) {
          serviceGroups['Mosás'] = { name: 'Mosás', quantity: 0, unitPrice: price, total: 0 };
        }
        serviceGroups['Mosás'].quantity += 1;
        serviceGroups['Mosás'].total += price;
      }
    }

    for (const [name, group] of Object.entries(serviceGroups)) {
      subtotal += group.total;
      itemsData.push({
        description: name,
        quantity: group.quantity,
        unitPrice: group.quantity > 0 ? group.total / group.quantity : 0,
        totalPrice: group.total,
        vatRate: vatPercent,
      });
    }

    const vatAmount = Math.round(subtotal * (vatPercent / 100));
    const total = subtotal + vatAmount;
    const dueDays = dto.dueDays || 15;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    // Get billing info from partner
    const invoice = await this.prisma.invoice.create({
      data: {
        networkId,
        partnerCompanyId: dto.partnerCompanyId,
        status: 'DRAFT',
        issueDate: new Date(),
        dueDate,
        subtotal,
        vatAmount,
        total,
        currency: 'HUF',
        paymentMethod: (dto.paymentMethod as any) || 'TRANSFER',
        periodStart: dto.startDate,
        periodEnd: dto.endDate,
        billingName: partner.name,
        billingAddress: partner.billingAddress || '',
        billingCity: partner.billingCity || '',
        billingZipCode: partner.billingZipCode || '',
        taxNumber: partner.taxNumber,
        items: {
          create: itemsData,
        },
      },
      include: {
        partnerCompany: true,
        items: true,
      },
    });

    // Link wash events to this invoice
    await this.prisma.washEvent.updateMany({
      where: { id: { in: washEvents.map((e) => e.id) } },
      data: { invoiceId: invoice.id },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'CREATE',
      actorType: 'USER',
      newData: {
        type: 'INVOICE',
        id: invoice.id,
        status: 'DRAFT',
        partnerName: partner.name,
        total,
        washEventCount: washEvents.length,
      },
      metadata: { entityType: 'invoice' },
    });

    return {
      id: invoice.id,
      status: invoice.status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      subtotal: Number(invoice.subtotal),
      vatAmount: Number(invoice.vatAmount),
      total: Number(invoice.total),
      currency: invoice.currency,
      partnerCompany: invoice.partnerCompany ? {
        id: invoice.partnerCompany.id,
        name: invoice.partnerCompany.name,
      } : null,
      // Include billing info for private customers
      billingName: invoice.billingName,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        vatRate: item.vatRate,
      })),
      washEventCount: washEvents.length,
    };
  }

  async issueInvoice(
    networkId: string,
    invoiceId: string,
    adminId: string,
  ): Promise<any> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, networkId, status: 'DRAFT' },
      include: { partnerCompany: true, items: true },
    });

    if (!invoice) {
      throw new NotFoundException('Számla nem található vagy már ki lett állítva');
    }

    // Generate invoice number
    const year = new Date().getFullYear();
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        networkId,
        invoiceNumber: { startsWith: `${year}-` },
      },
      orderBy: { invoiceNumber: 'desc' },
    });

    let nextNumber = 1;
    if (lastInvoice?.invoiceNumber) {
      const lastNum = parseInt(lastInvoice.invoiceNumber.split('-')[1], 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    const invoiceNumber = `${year}-${nextNumber.toString().padStart(5, '0')}`;

    // Update invoice status
    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'ISSUED',
        invoiceNumber,
        issueDate: new Date(),
      },
    });

    // TODO: If szamlazz.hu is configured, send to external provider
    // const settings = await this.prisma.networkSettings.findUnique({ where: { networkId } });
    // if (settings?.szamlazzAgentKey) {
    //   await this.sendToSzamlazz(invoice, settings.szamlazzAgentKey);
    // }

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      actorId: adminId,
      previousData: { type: 'INVOICE', id: invoice.id, status: 'DRAFT' },
      newData: { type: 'INVOICE', id: updated.id, status: 'ISSUED', invoiceNumber },
      metadata: { entityType: 'invoice', operation: 'issue' },
    });

    return {
      id: updated.id,
      invoiceNumber: updated.invoiceNumber,
      status: updated.status,
      issueDate: updated.issueDate,
    };
  }

  async markInvoicePaid(
    networkId: string,
    invoiceId: string,
    adminId: string,
    options: { paidDate: Date; paymentMethod?: string },
  ): Promise<any> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, networkId, status: { in: ['ISSUED', 'SENT', 'OVERDUE'] } },
    });

    if (!invoice) {
      throw new NotFoundException('Számla nem található vagy nem fizethető');
    }

    const updateData: any = {
      status: 'PAID',
      paidDate: options.paidDate,
    };
    if (options.paymentMethod) {
      updateData.paymentMethod = options.paymentMethod as any;
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      actorId: adminId,
      previousData: { type: 'INVOICE', id: invoice.id, status: invoice.status },
      newData: { type: 'INVOICE', id: updated.id, status: 'PAID', paidDate: options.paidDate },
      metadata: { entityType: 'invoice', operation: 'mark_paid' },
    });

    return {
      id: updated.id,
      status: updated.status,
      paidDate: updated.paidDate,
    };
  }

  async cancelInvoice(
    networkId: string,
    invoiceId: string,
    adminId: string,
    reason?: string,
  ): Promise<any> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, networkId, status: { not: 'CANCELLED' } },
    });

    if (!invoice) {
      throw new NotFoundException('Számla nem található vagy már sztornózva van');
    }

    // Unlink wash events
    await this.prisma.washEvent.updateMany({
      where: { invoiceId },
      data: { invoiceId: null },
    });

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // TODO: If external invoice was issued, create storno invoice
    // if (invoice.externalId) {
    //   await this.createStornoInvoice(invoice);
    // }

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      actorId: adminId,
      previousData: { type: 'INVOICE', id: invoice.id, status: invoice.status },
      newData: { type: 'INVOICE', id: updated.id, status: 'CANCELLED', reason },
      metadata: { entityType: 'invoice', operation: 'cancel' },
    });

    return {
      id: updated.id,
      status: updated.status,
      cancelledAt: updated.cancelledAt,
    };
  }

  async deleteInvoice(networkId: string, invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, networkId, status: 'DRAFT' },
    });

    if (!invoice) {
      throw new NotFoundException('Számla nem található vagy már ki lett állítva (csak piszkozat törölhető)');
    }

    // Unlink wash events
    await this.prisma.washEvent.updateMany({
      where: { invoiceId },
      data: { invoiceId: null },
    });

    // Delete items first
    await this.prisma.invoiceItem.deleteMany({
      where: { invoiceId },
    });

    // Delete invoice
    await this.prisma.invoice.delete({
      where: { id: invoiceId },
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'USER',
      previousData: { type: 'INVOICE', id: invoice.id, status: 'DRAFT' },
      newData: { type: 'INVOICE', id: invoice.id, deleted: true },
      metadata: { entityType: 'invoice', operation: 'delete' },
    });
  }

  async getUnbilledEvents(
    networkId: string,
    partnerCompanyId: string,
    options: { startDate?: Date; endDate?: Date },
  ): Promise<any> {
    const where: any = {
      networkId,
      partnerCompanyId,
      status: 'COMPLETED',
      invoiceId: null,
    };

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const events = await this.prisma.washEvent.findMany({
      where,
      include: {
        location: { select: { name: true } },
        services: { include: { servicePackage: true } },
        driver: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalAmount = events.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0);

    return {
      events: events.map((e) => ({
        id: e.id,
        createdAt: e.createdAt,
        tractorPlate: e.tractorPlateManual,
        locationName: e.location?.name,
        driverName: e.driver ? `${e.driver.lastName} ${e.driver.firstName}` : e.driverNameManual,
        services: e.services.map((s) => s.servicePackage?.name).filter(Boolean),
        totalPrice: Number(e.totalPrice || 0),
      })),
      summary: {
        eventCount: events.length,
        totalAmount,
      },
    };
  }

  // =========================================================================
  // REPORTS
  // =========================================================================

  async getWashStatistics(
    networkId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      locationId?: string;
      partnerCompanyId?: string;
      groupBy?: 'day' | 'week' | 'month' | 'location' | 'partner';
    },
  ): Promise<any> {
    const where: any = {
      networkId,
      status: { in: ['COMPLETED', 'LOCKED'] },
    };

    if (options.startDate || options.endDate) {
      where.completedAt = {};
      if (options.startDate) where.completedAt.gte = options.startDate;
      if (options.endDate) where.completedAt.lte = options.endDate;
    }

    if (options.locationId) {
      where.locationId = options.locationId;
    }

    if (options.partnerCompanyId) {
      where.partnerCompanyId = options.partnerCompanyId;
    }

    const washEvents = await this.prisma.washEvent.findMany({
      where,
      include: {
        location: { select: { id: true, name: true, code: true } },
        partnerCompany: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: 'asc' },
    });

    // Summary stats
    const totalWashes = washEvents.length;
    const totalRevenue = washEvents.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0);
    const averagePrice = totalWashes > 0 ? totalRevenue / totalWashes : 0;

    // Group data based on groupBy parameter
    let groupedData: any[] = [];

    if (options.groupBy === 'day') {
      const byDay = new Map<string, { count: number; revenue: number }>();
      washEvents.forEach((e) => {
        const date = e.completedAt ? e.completedAt.toISOString().split('T')[0] : 'Unknown';
        const current = byDay.get(date) || { count: 0, revenue: 0 };
        byDay.set(date, {
          count: current.count + 1,
          revenue: current.revenue + Number(e.totalPrice || 0),
        });
      });
      groupedData = Array.from(byDay.entries()).map(([date, data]) => ({
        label: date,
        count: data.count,
        revenue: data.revenue,
      }));
    } else if (options.groupBy === 'week') {
      const byWeek = new Map<string, { count: number; revenue: number }>();
      washEvents.forEach((e) => {
        if (!e.completedAt) return;
        const date = new Date(e.completedAt);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + 1);
        const weekKey = weekStart.toISOString().split('T')[0];
        const current = byWeek.get(weekKey) || { count: 0, revenue: 0 };
        byWeek.set(weekKey, {
          count: current.count + 1,
          revenue: current.revenue + Number(e.totalPrice || 0),
        });
      });
      groupedData = Array.from(byWeek.entries()).map(([week, data]) => ({
        label: `Hét: ${week}`,
        count: data.count,
        revenue: data.revenue,
      }));
    } else if (options.groupBy === 'month') {
      const byMonth = new Map<string, { count: number; revenue: number }>();
      washEvents.forEach((e) => {
        if (!e.completedAt) return;
        const month = e.completedAt.toISOString().substring(0, 7);
        const current = byMonth.get(month) || { count: 0, revenue: 0 };
        byMonth.set(month, {
          count: current.count + 1,
          revenue: current.revenue + Number(e.totalPrice || 0),
        });
      });
      groupedData = Array.from(byMonth.entries()).map(([month, data]) => ({
        label: month,
        count: data.count,
        revenue: data.revenue,
      }));
    } else if (options.groupBy === 'location') {
      const byLocation = new Map<string, { name: string; count: number; revenue: number }>();
      washEvents.forEach((e) => {
        const locId = e.locationId || 'unknown';
        const locName = e.location?.name || 'Ismeretlen';
        const current = byLocation.get(locId) || { name: locName, count: 0, revenue: 0 };
        byLocation.set(locId, {
          name: locName,
          count: current.count + 1,
          revenue: current.revenue + Number(e.totalPrice || 0),
        });
      });
      groupedData = Array.from(byLocation.entries()).map(([id, data]) => ({
        id,
        label: data.name,
        count: data.count,
        revenue: data.revenue,
      }));
    } else if (options.groupBy === 'partner') {
      const byPartner = new Map<string, { name: string; count: number; revenue: number }>();
      washEvents.forEach((e) => {
        const partnerId = e.partnerCompanyId || 'cash';
        const partnerName = e.partnerCompany?.name || 'Készpénzes';
        const current = byPartner.get(partnerId) || { name: partnerName, count: 0, revenue: 0 };
        byPartner.set(partnerId, {
          name: partnerName,
          count: current.count + 1,
          revenue: current.revenue + Number(e.totalPrice || 0),
        });
      });
      groupedData = Array.from(byPartner.entries()).map(([id, data]) => ({
        id,
        label: data.name,
        count: data.count,
        revenue: data.revenue,
      }));
    }

    // Status breakdown
    const statusCounts = await this.prisma.washEvent.groupBy({
      by: ['status'],
      where: { networkId, ...where },
      _count: true,
    });

    return {
      summary: {
        totalWashes,
        totalRevenue,
        averagePrice: Math.round(averagePrice),
        period: {
          startDate: options.startDate,
          endDate: options.endDate,
        },
      },
      groupedData,
      statusBreakdown: statusCounts.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    };
  }

  async getRevenueReport(
    networkId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      locationId?: string;
      partnerCompanyId?: string;
      groupBy?: 'day' | 'week' | 'month' | 'location' | 'partner' | 'service';
    },
  ): Promise<any> {
    const where: any = {
      networkId,
      status: { in: ['COMPLETED', 'LOCKED'] },
    };

    if (options.startDate || options.endDate) {
      where.completedAt = {};
      if (options.startDate) where.completedAt.gte = options.startDate;
      if (options.endDate) where.completedAt.lte = options.endDate;
    }

    if (options.locationId) {
      where.locationId = options.locationId;
    }

    if (options.partnerCompanyId) {
      where.partnerCompanyId = options.partnerCompanyId;
    }

    const washEvents = await this.prisma.washEvent.findMany({
      where,
      include: {
        location: { select: { id: true, name: true } },
        partnerCompany: { select: { id: true, name: true } },
        services: {
          include: {
            servicePackage: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { completedAt: 'asc' },
    });

    // Calculate totals
    const grossRevenue = washEvents.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0);

    // Estimate VAT (assuming 27% as default for HU)
    const vatRate = 0.27;
    const netRevenue = grossRevenue / (1 + vatRate);
    const vatAmount = grossRevenue - netRevenue;

    // Cash vs Contract breakdown
    const cashEvents = washEvents.filter((e) => !e.partnerCompanyId);
    const contractEvents = washEvents.filter((e) => e.partnerCompanyId);

    const cashRevenue = cashEvents.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0);
    const contractRevenue = contractEvents.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0);

    // Group by service if requested
    let serviceBreakdown: any[] = [];
    if (options.groupBy === 'service') {
      const byService = new Map<string, { name: string; count: number; revenue: number }>();
      washEvents.forEach((e) => {
        e.services.forEach((s) => {
          const serviceId = s.servicePackageId || 'unknown';
          const serviceName = s.servicePackage?.name || 'Ismeretlen';
          const current = byService.get(serviceId) || { name: serviceName, count: 0, revenue: 0 };
          byService.set(serviceId, {
            name: serviceName,
            count: current.count + 1,
            revenue: current.revenue + Number(s.totalPrice || 0),
          });
        });
      });
      serviceBreakdown = Array.from(byService.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        count: data.count,
        revenue: data.revenue,
      }));
    }

    // Daily trend for charts
    const dailyTrend: any[] = [];
    const byDay = new Map<string, number>();
    washEvents.forEach((e) => {
      if (!e.completedAt) return;
      const date = e.completedAt.toISOString().split('T')[0];
      byDay.set(date, (byDay.get(date) || 0) + Number(e.totalPrice || 0));
    });
    byDay.forEach((revenue, date) => {
      dailyTrend.push({ date, revenue });
    });
    dailyTrend.sort((a, b) => a.date.localeCompare(b.date));

    return {
      summary: {
        grossRevenue: Math.round(grossRevenue),
        netRevenue: Math.round(netRevenue),
        vatAmount: Math.round(vatAmount),
        washCount: washEvents.length,
        period: {
          startDate: options.startDate,
          endDate: options.endDate,
        },
      },
      breakdown: {
        cash: {
          count: cashEvents.length,
          revenue: Math.round(cashRevenue),
        },
        contract: {
          count: contractEvents.length,
          revenue: Math.round(contractRevenue),
        },
      },
      serviceBreakdown,
      dailyTrend,
    };
  }

  async getLocationPerformance(
    networkId: string,
    options: { startDate?: Date; endDate?: Date },
  ): Promise<any> {
    const locations = await this.prisma.location.findMany({
      where: { networkId, deletedAt: null },
      select: { id: true, name: true, code: true },
    });

    const where: any = {
      networkId,
      status: { in: ['COMPLETED', 'LOCKED'] },
    };

    if (options.startDate || options.endDate) {
      where.completedAt = {};
      if (options.startDate) where.completedAt.gte = options.startDate;
      if (options.endDate) where.completedAt.lte = options.endDate;
    }

    const washEvents = await this.prisma.washEvent.findMany({
      where,
      select: {
        locationId: true,
        totalPrice: true,
        completedAt: true,
        startedAt: true,
      },
    });

    const locationStats = locations.map((loc) => {
      const locEvents = washEvents.filter((e) => e.locationId === loc.id);
      const revenue = locEvents.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0);

      // Calculate average wash duration
      const durations = locEvents
        .filter((e) => e.startedAt && e.completedAt)
        .map((e) => (e.completedAt!.getTime() - e.startedAt!.getTime()) / 60000);
      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      return {
        id: loc.id,
        name: loc.name,
        code: loc.code,
        washCount: locEvents.length,
        revenue: Math.round(revenue),
        averagePrice: locEvents.length > 0 ? Math.round(revenue / locEvents.length) : 0,
        averageDurationMinutes: Math.round(avgDuration),
      };
    });

    // Sort by revenue descending
    locationStats.sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = locationStats.reduce((sum, l) => sum + l.revenue, 0);
    const totalWashes = locationStats.reduce((sum, l) => sum + l.washCount, 0);

    return {
      summary: {
        totalLocations: locations.length,
        totalWashes,
        totalRevenue,
        period: {
          startDate: options.startDate,
          endDate: options.endDate,
        },
      },
      locations: locationStats,
    };
  }

  async getPartnerSummary(
    networkId: string,
    options: { startDate?: Date; endDate?: Date },
  ): Promise<any> {
    const partners = await this.prisma.partnerCompany.findMany({
      where: { networkId, deletedAt: null },
      select: { id: true, name: true, taxNumber: true, billingType: true },
    });

    const where: any = {
      networkId,
      status: { in: ['COMPLETED', 'LOCKED'] },
    };

    if (options.startDate || options.endDate) {
      where.completedAt = {};
      if (options.startDate) where.completedAt.gte = options.startDate;
      if (options.endDate) where.completedAt.lte = options.endDate;
    }

    const washEvents = await this.prisma.washEvent.findMany({
      where,
      select: {
        partnerCompanyId: true,
        totalPrice: true,
        invoiceId: true,
      },
    });

    const partnerStats = partners.map((partner) => {
      const partnerEvents = washEvents.filter((e) => e.partnerCompanyId === partner.id);
      const revenue = partnerEvents.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0);
      const billedEvents = partnerEvents.filter((e) => e.invoiceId);
      const unbilledEvents = partnerEvents.filter((e) => !e.invoiceId);

      return {
        id: partner.id,
        name: partner.name,
        taxNumber: partner.taxNumber,
        billingType: partner.billingType,
        washCount: partnerEvents.length,
        revenue: Math.round(revenue),
        billedCount: billedEvents.length,
        billedAmount: Math.round(billedEvents.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0)),
        unbilledCount: unbilledEvents.length,
        unbilledAmount: Math.round(unbilledEvents.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0)),
      };
    });

    // Add cash customers (no partner)
    const cashEvents = washEvents.filter((e) => !e.partnerCompanyId);
    const cashRevenue = cashEvents.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0);

    // Sort by revenue descending
    partnerStats.sort((a, b) => b.revenue - a.revenue);

    return {
      summary: {
        totalPartners: partners.length,
        totalContractRevenue: partnerStats.reduce((sum, p) => sum + p.revenue, 0),
        totalCashRevenue: Math.round(cashRevenue),
        totalUnbilledAmount: partnerStats.reduce((sum, p) => sum + p.unbilledAmount, 0),
        period: {
          startDate: options.startDate,
          endDate: options.endDate,
        },
      },
      cash: {
        washCount: cashEvents.length,
        revenue: Math.round(cashRevenue),
      },
      partners: partnerStats,
    };
  }

  async getServiceBreakdown(
    networkId: string,
    options: { startDate?: Date; endDate?: Date; locationId?: string },
  ): Promise<any> {
    const where: any = {
      washEvent: {
        networkId,
        status: { in: ['COMPLETED', 'LOCKED'] },
      },
    };

    if (options.startDate || options.endDate) {
      where.washEvent.completedAt = {};
      if (options.startDate) where.washEvent.completedAt.gte = options.startDate;
      if (options.endDate) where.washEvent.completedAt.lte = options.endDate;
    }

    if (options.locationId) {
      where.washEvent.locationId = options.locationId;
    }

    const services = await this.prisma.washEventService.findMany({
      where,
      include: {
        servicePackage: { select: { id: true, name: true, code: true } },
      },
    });

    // Group by service package
    const byService = new Map<string, {
      name: string;
      code: string;
      count: number;
      revenue: number;
      vehicleTypes: Map<string, number>;
    }>();

    services.forEach((s) => {
      const serviceId = s.servicePackageId || 'unknown';
      const serviceName = s.servicePackage?.name || 'Ismeretlen';
      const serviceCode = s.servicePackage?.code || '';
      const vehicleType = s.vehicleType || 'UNKNOWN';

      const current = byService.get(serviceId) || {
        name: serviceName,
        code: serviceCode,
        count: 0,
        revenue: 0,
        vehicleTypes: new Map(),
      };

      current.count += 1;
      current.revenue += Number(s.totalPrice || 0);
      current.vehicleTypes.set(vehicleType, (current.vehicleTypes.get(vehicleType) || 0) + 1);

      byService.set(serviceId, current);
    });

    const serviceStats = Array.from(byService.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      code: data.code,
      count: data.count,
      revenue: Math.round(data.revenue),
      averagePrice: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
      vehicleTypeBreakdown: Array.from(data.vehicleTypes.entries()).map(([type, count]) => ({
        vehicleType: type,
        count,
      })),
    }));

    // Sort by revenue descending
    serviceStats.sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = serviceStats.reduce((sum, s) => sum + s.revenue, 0);
    const totalCount = serviceStats.reduce((sum, s) => sum + s.count, 0);

    return {
      summary: {
        totalServices: serviceStats.length,
        totalCount,
        totalRevenue,
        period: {
          startDate: options.startDate,
          endDate: options.endDate,
        },
      },
      services: serviceStats,
    };
  }

  async exportWashEventsCsv(
    networkId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      locationId?: string;
      partnerCompanyId?: string;
      status?: string;
    },
  ): Promise<any> {
    const where: any = {
      networkId,
    };

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    if (options.locationId) {
      where.locationId = options.locationId;
    }

    if (options.partnerCompanyId) {
      where.partnerCompanyId = options.partnerCompanyId;
    }

    if (options.status) {
      where.status = options.status;
    }

    const washEvents = await this.prisma.washEvent.findMany({
      where,
      include: {
        location: { select: { name: true, code: true } },
        partnerCompany: { select: { name: true } },
        driver: { select: { firstName: true, lastName: true } },
        services: {
          include: {
            servicePackage: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000, // Limit for performance
    });

    // Generate CSV header
    const headers = [
      'ID',
      'Dátum',
      'Helyszín',
      'Helyszín kód',
      'Státusz',
      'Típus',
      'Vontató rendszám',
      'Pótkocsi rendszám',
      'Jármű típus',
      'Sofőr',
      'Partner cég',
      'Szolgáltatások',
      'Ár (Ft)',
      'Kezdés',
      'Befejezés',
    ];

    // Generate CSV rows
    const rows = washEvents.map((e) => [
      e.id,
      e.createdAt.toISOString().split('T')[0],
      e.location?.name || '',
      e.location?.code || '',
      e.status,
      e.entryMode === 'QR_DRIVER' ? 'Sofőr' : 'Manuális',
      e.tractorPlateManual || '',
      e.trailerPlateManual || '',
      e.services[0]?.vehicleType || '',
      e.driver ? `${e.driver.lastName} ${e.driver.firstName}` : (e.driverNameManual || ''),
      e.partnerCompany?.name || 'Készpénzes',
      e.services.map((s) => s.servicePackage?.name).filter(Boolean).join('; '),
      Number(e.totalPrice || 0),
      e.startedAt ? e.startedAt.toISOString() : '',
      e.completedAt ? e.completedAt.toISOString() : '',
    ]);

    // Create CSV content
    const escapeCsvField = (field: any): string => {
      const str = String(field ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map(escapeCsvField).join(',')),
    ].join('\n');

    return {
      filename: `mosasok_${new Date().toISOString().split('T')[0]}.csv`,
      content: csvContent,
      mimeType: 'text/csv',
      rowCount: rows.length,
    };
  }

  // =========================================================================
  // OPENING HOURS
  // =========================================================================

  async getLocationOpeningHours(networkId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, networkId, deletedAt: null },
      include: {
        openingHoursStructured: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!location) {
      throw new NotFoundException('Helyszín nem található');
    }

    // Define day order for sorting
    const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

    // Map existing hours
    const existingHours = new Map(
      location.openingHoursStructured.map(h => [h.dayOfWeek, h])
    );

    // Return all days with defaults for missing ones
    const hours = dayOrder.map(day => {
      const existing = existingHours.get(day as any);
      return {
        dayOfWeek: day,
        openTime: existing ? existing.openTime : '08:00',
        closeTime: existing ? existing.closeTime : '18:00',
        isClosed: existing ? existing.isClosed : false,
      };
    });

    return {
      locationId: location.id,
      locationName: location.name,
      hours,
    };
  }

  async updateLocationOpeningHours(
    networkId: string,
    locationId: string,
    hours: { dayOfWeek: string; openTime: string; closeTime: string; isClosed: boolean }[],
  ) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, networkId, deletedAt: null },
    });

    if (!location) {
      throw new NotFoundException('Helyszín nem található');
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    for (const hour of hours) {
      if (!timeRegex.test(hour.openTime) || !timeRegex.test(hour.closeTime)) {
        throw new BadRequestException(`Érvénytelen időformátum: ${hour.dayOfWeek}`);
      }
    }

    // Update hours in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Delete existing hours for this location
      await tx.locationOpeningHours.deleteMany({
        where: { locationId },
      });

      // Create new hours
      for (const hour of hours) {
        await tx.locationOpeningHours.create({
          data: {
            locationId,
            dayOfWeek: hour.dayOfWeek as any,
            openTime: hour.openTime,
            closeTime: hour.closeTime,
            isClosed: hour.isClosed,
          },
        });
      }
    });

    // Audit log
    await this.auditLogService.log({
      networkId,
      action: 'UPDATE',
      actorType: 'NETWORK_ADMIN',
      newData: {
        type: 'LOCATION_OPENING_HOURS',
        locationId,
        locationName: location.name,
        hours
      },
      metadata: { entityType: 'location_opening_hours' },
    });

    // Return updated hours
    return this.getLocationOpeningHours(networkId, locationId);
  }
}
