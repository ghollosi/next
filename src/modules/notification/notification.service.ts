import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { VerificationType } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly adminNotificationEmail: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
  ) {
    this.adminNotificationEmail = this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL') || '';
  }

  // Generál egy egyedi tokent (email linkhez)
  private generateEmailToken(): string {
    return `ev_${randomBytes(32).toString('hex')}`;
  }

  // Generál egy 6 számjegyű kódot (SMS-hez)
  private generateSmsCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Email validációs token létrehozása és küldése
  async sendEmailVerification(
    networkId: string,
    driverId: string,
    email: string,
    firstName: string,
  ): Promise<{ success: boolean; tokenId?: string }> {
    // Töröljük a régi, nem használt tokeneket
    await this.prisma.verificationToken.deleteMany({
      where: {
        driverId,
        type: VerificationType.EMAIL,
        usedAt: null,
      },
    });

    // Új token létrehozása (24 órás lejárat)
    const token = this.generateEmailToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const verificationToken = await this.prisma.verificationToken.create({
      data: {
        networkId,
        driverId,
        type: VerificationType.EMAIL,
        token,
        destination: email,
        expiresAt,
      },
    });

    // Email küldése
    const sent = await this.emailService.sendVerificationEmail(email, firstName, token);

    return {
      success: sent,
      tokenId: verificationToken.id,
    };
  }

  // SMS validációs kód létrehozása és küldése
  async sendPhoneVerification(
    networkId: string,
    driverId: string,
    phone: string,
    firstName: string,
  ): Promise<{ success: boolean; tokenId?: string }> {
    // Töröljük a régi, nem használt tokeneket
    await this.prisma.verificationToken.deleteMany({
      where: {
        driverId,
        type: VerificationType.PHONE,
        usedAt: null,
      },
    });

    // Új kód létrehozása (10 perces lejárat)
    const code = this.generateSmsCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const verificationToken = await this.prisma.verificationToken.create({
      data: {
        networkId,
        driverId,
        type: VerificationType.PHONE,
        token: code,
        destination: phone,
        expiresAt,
      },
    });

    // SMS küldése
    const sent = await this.smsService.sendVerificationCode(phone, code, firstName);

    return {
      success: sent,
      tokenId: verificationToken.id,
    };
  }

  // Token validálása
  async verifyToken(
    token: string,
    type: VerificationType,
  ): Promise<{ valid: boolean; driverId?: string; message?: string }> {
    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return { valid: false, message: 'Érvénytelen kód' };
    }

    if (verificationToken.type !== type) {
      return { valid: false, message: 'Érvénytelen kód típus' };
    }

    if (verificationToken.usedAt) {
      return { valid: false, message: 'Ez a kód már fel lett használva' };
    }

    if (verificationToken.expiresAt < new Date()) {
      return { valid: false, message: 'A kód lejárt. Kérj újat!' };
    }

    // Token felhasználtnak jelölése
    await this.prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });

    // Driver validációs státusz frissítése (csak ha van driverId)
    if (verificationToken.driverId) {
      if (type === VerificationType.EMAIL) {
        await this.prisma.driver.update({
          where: { id: verificationToken.driverId },
          data: {
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
      } else {
        await this.prisma.driver.update({
          where: { id: verificationToken.driverId },
          data: {
            phoneVerified: true,
            phoneVerifiedAt: new Date(),
          },
        });
      }
    }

    return { valid: true, driverId: verificationToken.driverId || undefined };
  }

  // Új regisztrációról értesítések küldése
  async notifyNewRegistration(
    driver: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      email: string | null;
    },
    partnerCompany: {
      name: string;
      email: string | null;
      contactName: string | null;
    },
  ): Promise<void> {
    const driverName = `${driver.firstName} ${driver.lastName}`;

    // 1. Partner cég értesítése (ha van email)
    if (partnerCompany.email) {
      await this.emailService.sendNewRegistrationNotification(
        partnerCompany.email,
        partnerCompany.contactName || 'Tisztelt Partner',
        driverName,
        driver.phone,
        driver.email,
        partnerCompany.name,
      );
    }

    // 2. Admin értesítése
    if (this.adminNotificationEmail) {
      await this.emailService.sendNewRegistrationNotification(
        this.adminNotificationEmail,
        'Admin',
        driverName,
        driver.phone,
        driver.email,
        partnerCompany.name,
      );
    }

    // 3. Adatbázisból lekérjük az admin usereket is
    const adminUsers = await this.prisma.adminUser.findMany({
      where: {
        isActive: true,
      },
    });

    for (const admin of adminUsers) {
      if (admin.email !== this.adminNotificationEmail) {
        await this.emailService.sendNewRegistrationNotification(
          admin.email,
          admin.name,
          driverName,
          driver.phone,
          driver.email,
          partnerCompany.name,
        );
      }
    }
  }

  // Partner váltásról értesítés
  async notifyPartnerChange(
    driver: { firstName: string; lastName: string },
    fromCompany: { name: string; email: string | null; contactName: string | null } | null,
    toCompany: { name: string; email: string | null; contactName: string | null },
  ): Promise<void> {
    const driverName = `${driver.firstName} ${driver.lastName}`;

    // Régi cég értesítése (sofőr távozott)
    if (fromCompany?.email) {
      await this.emailService.sendPartnerChangeNotification(
        fromCompany.email,
        fromCompany.contactName || 'Tisztelt Partner',
        driverName,
        'left',
        fromCompany.name,
      );
    }

    // Új cég értesítése (sofőr csatlakozott)
    if (toCompany.email) {
      await this.emailService.sendPartnerChangeNotification(
        toCompany.email,
        toCompany.contactName || 'Tisztelt Partner',
        driverName,
        'joined',
        toCompany.name,
      );
    }
  }

  // Jóváhagyási email küldése
  async sendApprovalNotification(
    email: string,
    firstName: string,
    inviteCode: string,
  ): Promise<boolean> {
    return this.emailService.sendApprovalEmail(email, firstName, inviteCode);
  }
}
