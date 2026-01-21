import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenType } from '@prisma/client';
import * as crypto from 'crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;  // Access token expiry in seconds
  refreshExpiresIn: number;  // Refresh token expiry in seconds
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  networkId?: string;
  type: 'platform' | 'network';
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  // SECURITY: Token lifetimes
  private readonly ACCESS_TOKEN_EXPIRY = '15m';  // Short-lived access token
  private readonly ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;  // Refresh token valid for 7 days
  private readonly REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // SECURITY: Get JWT secret with production check
  private getJwtSecret(): string {
    const secret = this.configService.get('JWT_SECRET');
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return secret || 'dev-only-secret-do-not-use-in-production';
  }

  /**
   * Generate a cryptographically secure refresh token
   */
  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Create a new token pair (access + refresh)
   */
  async createTokenPair(
    payload: JwtPayload,
    type: RefreshTokenType,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenPair> {
    // Generate access token
    const accessToken = this.jwtService.sign(payload, {
      secret: this.getJwtSecret(),
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    // Generate refresh token
    const refreshToken = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        type,
        userId: payload.sub,
        networkId: payload.networkId || null,
        expiresAt,
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
      },
    });

    this.logger.log(`Created token pair for ${type} user ${payload.sub}`);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRY_SECONDS,
      refreshExpiresIn: this.REFRESH_TOKEN_EXPIRY_SECONDS,
    };
  }

  /**
   * Refresh tokens - validate refresh token and issue new pair
   * SECURITY: Implements token rotation - old refresh token is invalidated
   */
  async refreshTokens(
    refreshToken: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenPair> {
    // Find the refresh token
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    // SECURITY: Token not found
    if (!storedToken) {
      this.logger.warn('Refresh token not found');
      throw new UnauthorizedException('Invalid refresh token');
    }

    // SECURITY: Token already revoked - potential token theft!
    if (storedToken.revokedAt) {
      this.logger.error(`SECURITY: Attempted use of revoked refresh token for user ${storedToken.userId}`);
      // Revoke all tokens for this user as a security measure
      await this.revokeAllUserTokens(storedToken.userId, storedToken.type);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // SECURITY: Token expired
    if (storedToken.expiresAt < new Date()) {
      this.logger.warn(`Refresh token expired for user ${storedToken.userId}`);
      throw new UnauthorizedException('Refresh token expired');
    }

    // Get user details based on token type
    let payload: JwtPayload;

    if (storedToken.type === RefreshTokenType.PLATFORM_ADMIN) {
      const admin = await this.prisma.platformAdmin.findUnique({
        where: { id: storedToken.userId },
      });

      // Note: PlatformAdmin doesn't have deletedAt field
      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('User no longer active');
      }

      payload = {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        type: 'platform',
      };
    } else {
      const admin = await this.prisma.networkAdmin.findUnique({
        where: { id: storedToken.userId },
      });

      if (!admin || !admin.isActive || admin.deletedAt) {
        throw new UnauthorizedException('User no longer active');
      }

      payload = {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        networkId: admin.networkId,
        type: 'network',
      };
    }

    // SECURITY: Token rotation - revoke old token
    const newRefreshToken = this.generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Create new token and mark old one as replaced in a transaction
    const newTokenRecord = await this.prisma.$transaction(async (tx) => {
      // Revoke old token and link to new one
      const newToken = await tx.refreshToken.create({
        data: {
          token: newRefreshToken,
          type: storedToken.type,
          userId: storedToken.userId,
          networkId: storedToken.networkId,
          expiresAt: newExpiresAt,
          userAgent: metadata?.userAgent,
          ipAddress: metadata?.ipAddress,
        },
      });

      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          revokedAt: new Date(),
          replacedBy: newToken.id,
        },
      });

      return newToken;
    });

    // Generate new access token
    const accessToken = this.jwtService.sign(payload, {
      secret: this.getJwtSecret(),
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    this.logger.log(`Refreshed tokens for ${storedToken.type} user ${storedToken.userId}`);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRY_SECONDS,
      refreshExpiresIn: this.REFRESH_TOKEN_EXPIRY_SECONDS,
    };
  }

  /**
   * Revoke a specific refresh token (logout)
   */
  async revokeToken(refreshToken: string): Promise<void> {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (storedToken && !storedToken.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      this.logger.log(`Revoked refresh token for user ${storedToken.userId}`);
    }
  }

  /**
   * Revoke all refresh tokens for a user (password change, security incident)
   */
  async revokeAllUserTokens(userId: string, type?: RefreshTokenType): Promise<number> {
    const where: any = {
      userId,
      revokedAt: null,
    };

    if (type) {
      where.type = type;
    }

    const result = await this.prisma.refreshToken.updateMany({
      where,
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Revoked ${result.count} refresh tokens for user ${userId}`);
    return result.count;
  }

  /**
   * Clean up expired tokens (should be called periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() }, revokedAt: null },
          { revokedAt: { lt: thirtyDaysAgo } },
        ],
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired/revoked refresh tokens`);
    }

    return result.count;
  }

  /**
   * Validate access token and return payload
   */
  validateAccessToken(token: string): JwtPayload | null {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.getJwtSecret(),
      });

      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        networkId: payload.networkId,
        type: payload.type,
      };
    } catch {
      return null;
    }
  }
}
