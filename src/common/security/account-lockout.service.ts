import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * SECURITY: Account lockout service with database persistence
 *
 * Provides temporary account locking after multiple failed login attempts.
 * This is a complementary protection to rate limiting.
 *
 * - 5 failed attempts = 15 minute lockout
 * - Lockout is per-account, not per-IP
 * - Failed attempts are tracked in database (persists across restarts)
 * - Successful login clears the counter
 */
@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  // Configuration
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window for counting attempts

  constructor(private readonly prisma: PrismaService) {
    // Schedule cleanup every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Check if account is locked
   * @param identifier - Email or phone number
   * @returns Object with isLocked status and remaining seconds if locked
   */
  async isLocked(identifier: string): Promise<{ isLocked: boolean; remainingSeconds?: number }> {
    const key = identifier.toLowerCase();

    const record = await this.prisma.accountLockout.findUnique({
      where: { identifier: key },
    });

    if (!record || !record.lockedUntil) {
      return { isLocked: false };
    }

    const now = new Date();
    if (record.lockedUntil > now) {
      const remainingMs = record.lockedUntil.getTime() - now.getTime();
      return {
        isLocked: true,
        remainingSeconds: Math.ceil(remainingMs / 1000),
      };
    }

    // Lockout expired, clear it
    await this.prisma.accountLockout.update({
      where: { identifier: key },
      data: {
        lockedUntil: null,
        failedCount: 0,
      },
    });

    return { isLocked: false };
  }

  /**
   * Record a failed login attempt
   * @param identifier - Email or phone number
   * @returns Object with isNowLocked status and attempts remaining
   */
  async recordFailedAttempt(identifier: string): Promise<{ isNowLocked: boolean; attemptsRemaining: number }> {
    const key = identifier.toLowerCase();
    const now = new Date();

    // Upsert the record
    let record = await this.prisma.accountLockout.findUnique({
      where: { identifier: key },
    });

    if (!record) {
      record = await this.prisma.accountLockout.create({
        data: {
          identifier: key,
          failedCount: 1,
          lastAttemptAt: now,
        },
      });
    } else {
      // If last attempt was more than 1 hour ago, reset counter
      const hourAgo = new Date(now.getTime() - this.ATTEMPT_WINDOW_MS);
      const shouldReset = record.lastAttemptAt < hourAgo;

      record = await this.prisma.accountLockout.update({
        where: { identifier: key },
        data: {
          failedCount: shouldReset ? 1 : { increment: 1 },
          lastAttemptAt: now,
        },
      });
    }

    // Check if should lock
    if (record.failedCount >= this.MAX_ATTEMPTS) {
      const lockedUntil = new Date(now.getTime() + this.LOCKOUT_DURATION_MS);

      await this.prisma.accountLockout.update({
        where: { identifier: key },
        data: { lockedUntil },
      });

      this.logger.warn(`Account locked: ${key} (${record.failedCount} failed attempts)`);
      return { isNowLocked: true, attemptsRemaining: 0 };
    }

    return {
      isNowLocked: false,
      attemptsRemaining: this.MAX_ATTEMPTS - record.failedCount,
    };
  }

  /**
   * Clear failed attempts on successful login
   * @param identifier - Email or phone number
   */
  async clearFailedAttempts(identifier: string): Promise<void> {
    const key = identifier.toLowerCase();

    await this.prisma.accountLockout.deleteMany({
      where: { identifier: key },
    });
  }

  /**
   * Cleanup old entries to prevent database bloat
   */
  private async cleanup(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.ATTEMPT_WINDOW_MS * 2);

    try {
      const result = await this.prisma.accountLockout.deleteMany({
        where: {
          AND: [
            { lastAttemptAt: { lt: cutoff } },
            {
              OR: [
                { lockedUntil: null },
                { lockedUntil: { lt: now } },
              ],
            },
          ],
        },
      });

      if (result.count > 0) {
        this.logger.debug(`Cleaned up ${result.count} expired lockout records`);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup lockout records: ${error.message}`);
    }
  }

  /**
   * Get lockout status summary (for admin monitoring)
   */
  async getStats(): Promise<{ totalTracked: number; currentlyLocked: number }> {
    const now = new Date();

    const [totalTracked, currentlyLocked] = await Promise.all([
      this.prisma.accountLockout.count(),
      this.prisma.accountLockout.count({
        where: {
          lockedUntil: { gt: now },
        },
      }),
    ]);

    return {
      totalTracked,
      currentlyLocked,
    };
  }
}
