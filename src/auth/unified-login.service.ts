import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogService } from '../modules/audit-log/audit-log.service';
import { AuditAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import {
  UnifiedLoginDto,
  UnifiedLoginResponseDto,
  SelectRoleDto,
  SelectRoleResponseDto,
  FoundUser,
  UserRole,
} from './dto/unified-login.dto';

interface TempTokenPayload {
  email: string;
  roles: FoundUser[];
  exp: number;
}

@Injectable()
export class UnifiedLoginService {
  private readonly logger = new Logger(UnifiedLoginService.name);
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: number = 24 * 60 * 60; // 24 hours in seconds
  private readonly tempTokenExpiresIn: number = 5 * 60; // 5 minutes for role selection

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'fallback-secret-change-me';
  }

  /**
   * Unified login - searches all user tables for the given email
   */
  async login(
    dto: UnifiedLoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UnifiedLoginResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const foundUsers: FoundUser[] = [];

    // 1. Search Platform Admins
    const platformAdmins = await this.prisma.platformAdmin.findMany({
      where: { email, isActive: true },
    });

    for (const admin of platformAdmins) {
      if (admin.passwordHash && await bcrypt.compare(dto.password, admin.passwordHash)) {
        foundUsers.push({
          role: 'platform_admin',
          id: admin.id,
          email: admin.email,
          name: admin.name,
          platformRole: admin.role,
        });
      }
    }

    // 2. Search Network Admins (can be in multiple networks)
    const networkAdmins = await this.prisma.networkAdmin.findMany({
      where: { email, isActive: true, deletedAt: null },
      include: {
        network: { select: { id: true, name: true, slug: true } },
      },
    });

    for (const admin of networkAdmins) {
      if (admin.passwordHash && await bcrypt.compare(dto.password, admin.passwordHash)) {
        foundUsers.push({
          role: 'network_admin',
          id: admin.id,
          email: admin.email,
          name: admin.name,
          networkId: admin.networkId,
          networkName: admin.network.name,
          networkSlug: admin.network.slug,
        });
      }
    }

    // 3. Search Location Operators
    const operators = await this.prisma.locationOperator.findMany({
      where: { email, isActive: true, deletedAt: null },
      include: {
        location: { select: { id: true, name: true, networkId: true } },
        network: { select: { name: true } },
      },
    });

    for (const op of operators) {
      if (op.passwordHash && await bcrypt.compare(dto.password, op.passwordHash)) {
        foundUsers.push({
          role: 'operator',
          id: op.id,
          email: op.email!,
          name: op.name,
          networkId: op.networkId,
          networkName: op.network.name,
          locationId: op.locationId,
          locationName: op.location.name,
        });
      }
    }

    // 4. Search Partner Companies (partner admins)
    const partners = await this.prisma.partnerCompany.findMany({
      where: { email, isActive: true, deletedAt: null },
      include: {
        network: { select: { name: true } },
      },
    });

    for (const partner of partners) {
      if (partner.passwordHash && await bcrypt.compare(dto.password, partner.passwordHash)) {
        foundUsers.push({
          role: 'partner',
          id: partner.id,
          email: partner.email!,
          name: partner.name,
          networkId: partner.networkId,
          networkName: partner.network.name,
          partnerId: partner.id,
          partnerName: partner.name,
        });
      }
    }

    // 5. Search Drivers
    const drivers = await this.prisma.driver.findMany({
      where: { email, isActive: true, deletedAt: null },
      include: {
        network: { select: { name: true } },
        partnerCompany: { select: { id: true, name: true } },
      },
    });

    for (const driver of drivers) {
      if (driver.passwordHash && await bcrypt.compare(dto.password, driver.passwordHash)) {
        foundUsers.push({
          role: 'driver',
          id: driver.id,
          email: driver.email!,
          name: `${driver.firstName} ${driver.lastName}`,
          networkId: driver.networkId,
          networkName: driver.network.name,
          partnerId: driver.partnerCompanyId || undefined,
          partnerName: driver.partnerCompany?.name,
        });
      }
    }

    // No valid credentials found
    if (foundUsers.length === 0) {
      // Log failed attempt
      await this.auditLogService.log({
        action: AuditAction.LOGIN_FAILED,
        actorType: 'SYSTEM',
        metadata: { email, error: 'Invalid credentials - no matching user found' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Hibás email cím vagy jelszó');
    }

    // Single role found - auto login
    if (foundUsers.length === 1) {
      const user = foundUsers[0];
      const tokens = this.generateTokens(user);

      // Log successful login
      await this.logSuccessfulLogin(user, ipAddress, userAgent);

      return {
        multipleRoles: false,
        selectedRole: user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: this.jwtExpiresIn,
        redirectUrl: this.getRedirectUrl(user),
      };
    }

    // Multiple roles found - return temp token for role selection
    const tempToken = this.generateTempToken(email, foundUsers);

    this.logger.log(`Multiple roles found for ${email}: ${foundUsers.map(u => u.role).join(', ')}`);

    return {
      multipleRoles: true,
      availableRoles: foundUsers.map(user => ({
        ...user,
        // Don't expose sensitive data in the list
      })),
    };
  }

  /**
   * Select a role after multiple roles were found
   */
  async selectRole(
    dto: SelectRoleDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SelectRoleResponseDto> {
    // Verify and decode temp token
    let payload: TempTokenPayload;
    try {
      payload = jwt.verify(dto.tempToken, this.jwtSecret) as TempTokenPayload;
    } catch {
      throw new UnauthorizedException('Érvénytelen vagy lejárt token. Kérjük, jelentkezz be újra.');
    }

    // Find the selected role in the payload
    const selectedUser = payload.roles.find(
      (r) => r.role === dto.role && r.id === dto.entityId,
    );

    if (!selectedUser) {
      throw new UnauthorizedException('A kiválasztott fiók nem található');
    }

    // Generate tokens for the selected role
    const tokens = this.generateTokens(selectedUser);

    // Log successful login
    await this.logSuccessfulLogin(selectedUser, ipAddress, userAgent);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.jwtExpiresIn,
      redirectUrl: this.getRedirectUrl(selectedUser),
      selectedRole: selectedUser,
    };
  }

  /**
   * Generate JWT tokens for a user
   */
  private generateTokens(user: FoundUser): { accessToken: string; refreshToken: string } {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      networkId: user.networkId,
      locationId: user.locationId,
      partnerId: user.partnerId,
      platformRole: user.platformRole,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: 7 * 24 * 60 * 60 }, // 7 days
    );

    return { accessToken, refreshToken };
  }

  /**
   * Generate temporary token for role selection (5 min expiry)
   */
  private generateTempToken(email: string, roles: FoundUser[]): string {
    const payload: TempTokenPayload = {
      email,
      roles,
      exp: Math.floor(Date.now() / 1000) + this.tempTokenExpiresIn,
    };

    return jwt.sign(payload, this.jwtSecret);
  }

  /**
   * Get redirect URL based on user role
   */
  private getRedirectUrl(user: FoundUser): string {
    switch (user.role) {
      case 'platform_admin':
        return '/platform-admin/dashboard';
      case 'network_admin':
        return '/network-admin/dashboard';
      case 'operator':
        return '/operator-portal/dashboard';
      case 'partner':
        return '/partner/dashboard';
      case 'driver':
        return '/dashboard';
      default:
        return '/';
    }
  }

  /**
   * Log successful login to audit log
   */
  private async logSuccessfulLogin(
    user: FoundUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const actorTypeMap: Record<UserRole, string> = {
      platform_admin: 'PLATFORM_ADMIN',
      network_admin: 'NETWORK_ADMIN',
      operator: 'OPERATOR',
      partner: 'PARTNER',
      driver: 'DRIVER',
    };

    await this.auditLogService.log({
      networkId: user.networkId,
      action: AuditAction.LOGIN_SUCCESS,
      actorType: actorTypeMap[user.role] as any,
      actorId: user.id,
      metadata: {
        email: user.email,
        role: user.role,
        name: user.name,
        loginMethod: 'unified_login',
      },
      ipAddress,
      userAgent,
    });
  }
}
