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
    networkId?: string,
  ): Promise<void> {
    const driverName = `${driver.firstName} ${driver.lastName}`;
    const sentEmails = new Set<string>(); // Prevent duplicate emails

    // 1. Sofőrnek értesítés (ha van email)
    if (driver.email) {
      const sent = await this.emailService['sendEmail']({
        to: driver.email,
        subject: 'VSys Wash - Regisztráció sikeres!',
        html: this.getDriverRegistrationEmailHtml(driverName, partnerCompany.name),
        text: `Kedves ${driverName}!\n\nSikeres regisztrációdat köszönjük! A hozzáférésed jóváhagyás után válik aktívvá.\n\nPartner: ${partnerCompany.name}`,
      });
      if (sent) {
        sentEmails.add(driver.email);
        this.logger.log(`Registration confirmation email sent to driver: ${driver.email}`);
      }
    }

    // 2. Partner cég értesítése (ha van email)
    if (partnerCompany.email && !sentEmails.has(partnerCompany.email)) {
      await this.emailService.sendNewRegistrationNotification(
        partnerCompany.email,
        partnerCompany.contactName || 'Tisztelt Partner',
        driverName,
        driver.phone,
        driver.email,
        partnerCompany.name,
      );
      sentEmails.add(partnerCompany.email);
    }

    // 3. Hálózat admin értesítése (ha van networkId)
    if (networkId) {
      const networkAdmins = await this.prisma.networkAdmin.findMany({
        where: {
          networkId,
          isActive: true,
          deletedAt: null,
        },
      });

      for (const admin of networkAdmins) {
        if (!sentEmails.has(admin.email)) {
          await this.emailService.sendNewRegistrationNotification(
            admin.email,
            admin.name,
            driverName,
            driver.phone,
            driver.email,
            partnerCompany.name,
          );
          sentEmails.add(admin.email);
          this.logger.log(`New driver notification sent to network admin: ${admin.email}`);
        }
      }
    }

    // 4. Platform admin értesítése
    if (this.adminNotificationEmail && !sentEmails.has(this.adminNotificationEmail)) {
      await this.emailService.sendNewRegistrationNotification(
        this.adminNotificationEmail,
        'Admin',
        driverName,
        driver.phone,
        driver.email,
        partnerCompany.name,
      );
      sentEmails.add(this.adminNotificationEmail);
    }

    // 5. Adatbázisból lekérjük az admin usereket is (platform adminok)
    const adminUsers = await this.prisma.adminUser.findMany({
      where: {
        isActive: true,
      },
    });

    for (const admin of adminUsers) {
      if (!sentEmails.has(admin.email)) {
        await this.emailService.sendNewRegistrationNotification(
          admin.email,
          admin.name,
          driverName,
          driver.phone,
          driver.email,
          partnerCompany.name,
        );
        sentEmails.add(admin.email);
      }
    }
  }

  private getDriverRegistrationEmailHtml(driverName: string, partnerCompanyName: string): string {
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
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VSys Wash</h1>
      <p>Regisztráció sikeres!</p>
    </div>
    <div class="content">
      <h2>Kedves ${driverName}!</h2>
      <p>Köszönjük, hogy regisztráltál a VSys Wash rendszerbe!</p>

      <div class="info-box">
        <p><strong>Partner cég:</strong> ${partnerCompanyName}</p>
        <p><strong>Státusz:</strong> Jóváhagyásra vár</p>
      </div>

      <p>A regisztrációdat a partner cég adminisztrátora fogja jóváhagyni. Amint ez megtörtént, emailben értesítünk és megkapod a bejelentkezési adataidat.</p>

      <h3>Mi történik ezután?</h3>
      <ol>
        <li>A partner cég jóváhagyja a regisztrációdat</li>
        <li>Megkapod a meghívó kódodat emailben</li>
        <li>Bejelentkezhetsz az alkalmazásba és használhatod a szolgáltatást</li>
      </ol>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} VSys Wash. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;
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
