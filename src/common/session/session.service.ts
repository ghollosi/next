import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SessionType } from '@prisma/client';
import * as crypto from 'crypto';

export interface DriverSessionData {
  driverId: string;
  networkId: string;
  partnerCompanyId?: string;  // Optional for private customers
}

export interface OperatorSessionData {
  networkId: string;
  locationId: string;
  locationName: string;
  locationCode: string;
  washMode: string;
  operatorId: string | null;
  operatorName: string;
}

export interface PartnerSessionData {
  partnerId: string;
  networkId: string;
  partnerName: string;
}

type SessionData = DriverSessionData | OperatorSessionData | PartnerSessionData;

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  // Session élettartam: 24 óra
  private readonly SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Automatikus cleanup - óránként törli a lejárt session-öket
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleSessionCleanup(): Promise<void> {
    const count = await this.cleanupExpiredSessions();
    if (count > 0) {
      this.logger.log(`Cleaned up ${count} expired sessions`);
    }
  }

  /**
   * Generál egy egyedi session ID-t
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Létrehoz egy új session-t az adatbázisban
   */
  async createSession<T extends SessionData>(
    type: SessionType,
    data: T,
    options?: {
      networkId?: string;
      userId?: string;
      durationMs?: number;
    },
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const durationMs = options?.durationMs || this.SESSION_DURATION_MS;
    const expiresAt = new Date(Date.now() + durationMs);

    await this.prisma.session.create({
      data: {
        sessionId,
        type,
        data: data as any,
        expiresAt,
        networkId: options?.networkId,
        userId: options?.userId,
      },
    });

    return sessionId;
  }

  /**
   * Lekérdez egy session-t az ID alapján
   * Automatikusan frissíti a lastUsedAt mezőt
   */
  async getSession<T extends SessionData>(
    sessionId: string,
    expectedType?: SessionType,
  ): Promise<T | null> {
    const session = await this.prisma.session.findUnique({
      where: { sessionId },
    });

    if (!session) {
      return null;
    }

    // Ellenőrizzük a típust ha megadták
    if (expectedType && session.type !== expectedType) {
      return null;
    }

    // Ellenőrizzük, hogy lejárt-e
    if (session.expiresAt < new Date()) {
      // Töröljük a lejárt session-t
      await this.prisma.session.delete({
        where: { sessionId },
      });
      return null;
    }

    // Frissítjük a lastUsedAt-et
    await this.prisma.session.update({
      where: { sessionId },
      data: { lastUsedAt: new Date() },
    });

    return session.data as unknown as T;
  }

  /**
   * Frissíti a session adatait
   */
  async updateSession<T extends SessionData>(
    sessionId: string,
    data: Partial<T>,
  ): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { sessionId },
    });

    if (!session || session.expiresAt < new Date()) {
      return false;
    }

    const currentData = session.data as Record<string, any>;
    const newData = { ...currentData, ...data };

    await this.prisma.session.update({
      where: { sessionId },
      data: {
        data: newData,
        lastUsedAt: new Date(),
      },
    });

    return true;
  }

  /**
   * Törli a session-t (kijelentkezés)
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { sessionId },
    });
  }

  /**
   * Törli az összes lejárt session-t (cron job-ból hívható)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Törli a felhasználó összes session-jét
   */
  async deleteUserSessions(userId: string, type?: SessionType): Promise<void> {
    const where: any = { userId };
    if (type) {
      where.type = type;
    }

    await this.prisma.session.deleteMany({ where });
  }

  /**
   * Meghosszabbítja a session élettartamát
   */
  async extendSession(sessionId: string, durationMs?: number): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { sessionId },
    });

    if (!session || session.expiresAt < new Date()) {
      return false;
    }

    const duration = durationMs || this.SESSION_DURATION_MS;
    const newExpiresAt = new Date(Date.now() + duration);

    await this.prisma.session.update({
      where: { sessionId },
      data: {
        expiresAt: newExpiresAt,
        lastUsedAt: new Date(),
      },
    });

    return true;
  }
}
