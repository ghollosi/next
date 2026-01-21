import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * SECURITY: Account lockout service
 *
 * Provides temporary account locking after multiple failed login attempts.
 * This is a complementary protection to rate limiting.
 *
 * - 5 failed attempts = 15 minute lockout
 * - Lockout is per-account, not per-IP
 * - Failed attempts are tracked in memory (cleared on restart)
 * - Successful login clears the counter
 */
@Injectable()
export class AccountLockoutService {
  // In-memory storage for failed attempts
  // Key: identifier (email/phone), Value: { count, lastAttempt, lockedUntil }
  private failedAttempts = new Map<string, {
    count: number;
    lastAttempt: Date;
    lockedUntil: Date | null;
  }>();

  // Configuration
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window for counting attempts

  constructor(private readonly prisma: PrismaService) {
    // Clean up old entries every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Check if account is locked
   * @param identifier - Email or phone number
   * @returns Object with isLocked status and remaining seconds if locked
   */
  isLocked(identifier: string): { isLocked: boolean; remainingSeconds?: number } {
    const key = identifier.toLowerCase();
    const record = this.failedAttempts.get(key);

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
    record.lockedUntil = null;
    record.count = 0;
    return { isLocked: false };
  }

  /**
   * Record a failed login attempt
   * @param identifier - Email or phone number
   * @returns Object with isNowLocked status and attempts remaining
   */
  recordFailedAttempt(identifier: string): { isNowLocked: boolean; attemptsRemaining: number } {
    const key = identifier.toLowerCase();
    const now = new Date();
    let record = this.failedAttempts.get(key);

    if (!record) {
      record = { count: 0, lastAttempt: now, lockedUntil: null };
      this.failedAttempts.set(key, record);
    }

    // If last attempt was more than 1 hour ago, reset counter
    const hourAgo = new Date(now.getTime() - this.ATTEMPT_WINDOW_MS);
    if (record.lastAttempt < hourAgo) {
      record.count = 0;
    }

    record.count++;
    record.lastAttempt = now;

    // Check if should lock
    if (record.count >= this.MAX_ATTEMPTS) {
      record.lockedUntil = new Date(now.getTime() + this.LOCKOUT_DURATION_MS);
      return { isNowLocked: true, attemptsRemaining: 0 };
    }

    return {
      isNowLocked: false,
      attemptsRemaining: this.MAX_ATTEMPTS - record.count,
    };
  }

  /**
   * Clear failed attempts on successful login
   * @param identifier - Email or phone number
   */
  clearFailedAttempts(identifier: string): void {
    const key = identifier.toLowerCase();
    this.failedAttempts.delete(key);
  }

  /**
   * Cleanup old entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.ATTEMPT_WINDOW_MS * 2);

    for (const [key, record] of this.failedAttempts.entries()) {
      // Remove if last attempt was more than 2 hours ago and not locked
      if (record.lastAttempt < cutoff && (!record.lockedUntil || record.lockedUntil < now)) {
        this.failedAttempts.delete(key);
      }
    }
  }

  /**
   * Get lockout status summary (for admin monitoring)
   */
  getStats(): { totalTracked: number; currentlyLocked: number } {
    let currentlyLocked = 0;
    const now = new Date();

    for (const record of this.failedAttempts.values()) {
      if (record.lockedUntil && record.lockedUntil > now) {
        currentlyLocked++;
      }
    }

    return {
      totalTracked: this.failedAttempts.size,
      currentlyLocked,
    };
  }
}
