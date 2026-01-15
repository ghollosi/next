import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailProvider } from '@prisma/client';
import * as nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface NetworkEmailConfig {
  provider: EmailProvider;
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendApiKey: string;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;
  private readonly apiUrl: string;
  // Platform SMTP config
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpUser: string;
  private readonly smtpPass: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY') || '';
    this.fromAddress = this.configService.get<string>('EMAIL_FROM_ADDRESS') || this.configService.get<string>('SMTP_FROM') || 'info@vemiax.com';
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME') || this.configService.get<string>('SMTP_FROM_NAME') || 'Vemiax';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.vemiax.com';
    this.apiUrl = this.configService.get<string>('API_URL') || 'https://api.vemiax.com';
    // Platform SMTP config
    this.smtpHost = this.configService.get<string>('SMTP_HOST') || '';
    this.smtpPort = parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10);
    this.smtpUser = this.configService.get<string>('SMTP_USER') || '';
    this.smtpPass = this.configService.get<string>('SMTP_PASS') || '';
  }

  /**
   * Get email configuration for a network
   */
  async getNetworkEmailConfig(networkId: string): Promise<NetworkEmailConfig | null> {
    const settings = await this.prisma.networkSettings.findUnique({
      where: { networkId },
      select: {
        emailProvider: true,
        resendApiKey: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPassword: true,
        smtpFromEmail: true,
        smtpFromName: true,
      },
    });

    if (!settings) {
      return null;
    }

    return {
      provider: settings.emailProvider,
      resendApiKey: settings.resendApiKey || undefined,
      smtpHost: settings.smtpHost || undefined,
      smtpPort: settings.smtpPort || undefined,
      smtpUser: settings.smtpUser || undefined,
      smtpPassword: settings.smtpPassword || undefined,
      smtpFromEmail: settings.smtpFromEmail || undefined,
      smtpFromName: settings.smtpFromName || undefined,
    };
  }

  /**
   * Send email using network's configured provider
   */
  async sendNetworkEmail(networkId: string, options: SendEmailOptions): Promise<boolean> {
    const config = await this.getNetworkEmailConfig(networkId);

    if (!config) {
      this.logger.warn(`No email config found for network ${networkId}, using platform default`);
      return this.sendEmail(options);
    }

    try {
      switch (config.provider) {
        case 'RESEND':
          return await this.sendViaResend(config, options);
        case 'SMTP':
          return await this.sendViaSmtp(config, options);
        case 'PLATFORM':
        default:
          return await this.sendEmail(options);
      }
    } catch (error) {
      this.logger.error(`Failed to send network email: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Send email via network's Resend API key
   */
  private async sendViaResend(config: NetworkEmailConfig, options: SendEmailOptions): Promise<boolean> {
    if (!config.resendApiKey) {
      this.logger.warn('Network Resend API key not configured, falling back to platform');
      return this.sendEmail(options);
    }

    try {
      const fromName = config.smtpFromName || this.fromName;
      const fromEmail = config.smtpFromEmail || this.fromAddress;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from || `${fromName} <${fromEmail}>`,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Network Resend API error: ${error}`);
        return false;
      }

      const result = await response.json();
      this.logger.log(`Email sent via Network Resend: ${result.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Network Resend error: ${error.message}`);
      return false;
    }
  }

  /**
   * Send email via network's SMTP server
   */
  private async sendViaSmtp(config: NetworkEmailConfig, options: SendEmailOptions): Promise<boolean> {
    if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
      this.logger.warn('Network SMTP configuration incomplete, falling back to platform');
      return this.sendEmail(options);
    }

    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: config.smtpPort === 465,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword,
        },
      });

      const fromName = config.smtpFromName || this.fromName;
      const fromEmail = config.smtpFromEmail || config.smtpUser;

      const info = await transporter.sendMail({
        from: options.from || `"${fromName}" <${fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(`Email sent via Network SMTP: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Network SMTP error: ${error.message}`);
      return false;
    }
  }

  /**
   * Test email configuration for a network
   */
  async testNetworkEmailConfig(networkId: string, testEmail: string): Promise<{ success: boolean; message: string; provider?: string }> {
    const config = await this.getNetworkEmailConfig(networkId);

    if (!config) {
      return { success: false, message: 'Email konfiguráció nem található' };
    }

    const testOptions: SendEmailOptions = {
      to: testEmail,
      subject: 'vSys - Email teszt',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1>vSys Wash</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2>Email teszt sikeres!</h2>
            <p>Ez egy teszt email a vSys rendszerből.</p>
            <p><strong>Provider:</strong> ${config.provider}</p>
            <p><strong>Időpont:</strong> ${new Date().toLocaleString('hu-HU')}</p>
          </div>
        </div>
      `,
      text: `Email teszt sikeres! Provider: ${config.provider}`,
    };

    const success = await this.sendNetworkEmail(networkId, testOptions);

    return {
      success,
      message: success
        ? `Teszt email sikeresen elküldve (${config.provider})`
        : 'Nem sikerült elküldeni a teszt emailt',
      provider: config.provider,
    };
  }

  // Platform level email sending (fallback)
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    // Try SMTP first if configured
    if (this.smtpHost && this.smtpUser && this.smtpPass) {
      return this.sendViaPlatformSmtp(options);
    }

    // Fall back to Resend if configured
    if (this.resendApiKey) {
      return this.sendViaPlatformResend(options);
    }

    this.logger.warn('No email provider configured (SMTP or Resend), email sending disabled');
    this.logger.debug(`Would send email to ${options.to}: ${options.subject}`);
    return false;
  }

  // Send via platform SMTP
  private async sendViaPlatformSmtp(options: SendEmailOptions): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpPort === 465,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: options.from || `"${this.fromName}" <${this.fromAddress}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(`Email sent via Platform SMTP: ${info.messageId} to ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Platform SMTP error: ${error.message}`);
      return false;
    }
  }

  // Send via platform Resend
  private async sendViaPlatformResend(options: SendEmailOptions): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from || `${this.fromName} <${this.fromAddress}>`,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        this.logger.error(`Failed to send email: ${JSON.stringify(error)}`);
        return false;
      }

      this.logger.log(`Email sent via Resend to ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Resend error: ${error}`);
      return false;
    }
  }

  // Email validációs link küldése
  async sendVerificationEmail(
    to: string,
    firstName: string,
    token: string,
  ): Promise<boolean> {
    // Use API endpoint directly - it will redirect to frontend after verification
    const verifyUrl = `${this.apiUrl}/pwa/verify-email?token=${token}`;

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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VSys Wash</h1>
    </div>
    <div class="content">
      <h2>Kedves ${firstName}!</h2>
      <p>Köszönjük a regisztrációt a VSys Wash rendszerbe.</p>
      <p>Kérjük, erősítsd meg az email címedet az alábbi gombra kattintva:</p>
      <p style="text-align: center;">
        <a href="${verifyUrl}" class="button">Email cím megerősítése</a>
      </p>
      <p>Ha a gomb nem működik, másold be ezt a linket a böngésződbe:</p>
      <p style="word-break: break-all; color: #6b7280; font-size: 12px;">${verifyUrl}</p>
      <p>A link 24 órán belül lejár.</p>
      <p>Ha nem te regisztráltál, kérjük, hagyd figyelmen kívül ezt az emailt.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} VSys Wash. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Kedves ${firstName}!

Köszönjük a regisztrációt a VSys Wash rendszerbe.

Kérjük, erősítsd meg az email címedet az alábbi linkre kattintva:
${verifyUrl}

A link 24 órán belül lejár.

Ha nem te regisztráltál, kérjük, hagyd figyelmen kívül ezt az emailt.

© ${new Date().getFullYear()} VSys Wash
    `;

    return this.sendEmail({
      to,
      subject: 'VSys Wash - Email cím megerősítése',
      html,
      text,
    });
  }

  // Új regisztráció értesítés admin/partner felé
  async sendNewRegistrationNotification(
    to: string,
    recipientName: string,
    driverName: string,
    driverPhone: string | null,
    driverEmail: string | null,
    partnerCompanyName: string,
  ): Promise<boolean> {
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
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .label { color: #6b7280; font-size: 12px; text-transform: uppercase; }
    .value { font-weight: bold; font-size: 16px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VSys Wash</h1>
      <p>Új sofőr regisztráció</p>
    </div>
    <div class="content">
      <h2>Kedves ${recipientName}!</h2>
      <p>Új sofőr regisztrált a VSys Wash rendszerbe és jóváhagyásra vár.</p>

      <div class="info-box">
        <div class="label">Sofőr neve</div>
        <div class="value">${driverName}</div>
      </div>

      ${driverPhone ? `
      <div class="info-box">
        <div class="label">Telefonszám</div>
        <div class="value">${driverPhone}</div>
      </div>
      ` : ''}

      ${driverEmail ? `
      <div class="info-box">
        <div class="label">Email</div>
        <div class="value">${driverEmail}</div>
      </div>
      ` : ''}

      <div class="info-box">
        <div class="label">Partner cég</div>
        <div class="value">${partnerCompanyName}</div>
      </div>

      <p>Kérjük, ellenőrizd és hagyd jóvá a regisztrációt az admin felületen.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} VSys Wash. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Kedves ${recipientName}!

Új sofőr regisztrált a VSys Wash rendszerbe és jóváhagyásra vár.

Sofőr neve: ${driverName}
${driverPhone ? `Telefonszám: ${driverPhone}` : ''}
${driverEmail ? `Email: ${driverEmail}` : ''}
Partner cég: ${partnerCompanyName}

Kérjük, ellenőrizd és hagyd jóvá a regisztrációt az admin felületen.

© ${new Date().getFullYear()} VSys Wash
    `;

    return this.sendEmail({
      to,
      subject: `VSys Wash - Új sofőr regisztráció: ${driverName}`,
      html,
      text,
    });
  }

  // Partner váltás értesítés
  async sendPartnerChangeNotification(
    to: string,
    recipientName: string,
    driverName: string,
    action: 'joined' | 'left',
    companyName: string,
  ): Promise<boolean> {
    const actionText = action === 'joined' ? 'csatlakozott' : 'elhagyta a céget';
    const actionTitle = action === 'joined' ? 'Új sofőr csatlakozott' : 'Sofőr távozott';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${action === 'joined' ? '#059669' : '#dc2626'}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VSys Wash</h1>
      <p>${actionTitle}</p>
    </div>
    <div class="content">
      <h2>Kedves ${recipientName}!</h2>
      <p><strong>${driverName}</strong> ${actionText}: <strong>${companyName}</strong></p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} VSys Wash. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: `VSys Wash - ${actionTitle}: ${driverName}`,
      html,
    });
  }

  // Foglalás visszaigazoló email
  async sendBookingConfirmationEmail(
    networkId: string,
    to: string,
    customerName: string,
    bookingDetails: {
      bookingCode: string;
      locationName: string;
      locationAddress?: string;
      scheduledStart: Date;
      scheduledEnd: Date;
      serviceName: string;
      vehicleType: string;
      plateNumber?: string;
      price: number;
      currency: string;
    },
  ): Promise<boolean> {
    const vehicleTypeLabels: Record<string, string> = {
      CAR: 'Személyautó',
      VAN: 'Kisteherautó',
      BUS: 'Busz',
      SEMI_TRUCK: 'Kamion',
      TRUCK_12T: 'Kamion 12t',
      TRAILER: 'Pótkocsi',
    };

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });
    };

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    };

    const formatPrice = (price: number, currency: string) => {
      return new Intl.NumberFormat('hu-HU', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
      }).format(price);
    };

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
    .code-box { background: white; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .code { font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #2563eb; font-family: monospace; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; }
    .info-value { font-weight: 600; text-align: right; }
    .price-row { font-size: 18px; color: #2563eb; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Foglalás visszaigazolás</h1>
      <p>VSys Wash</p>
    </div>
    <div class="content">
      <h2>Kedves ${customerName}!</h2>
      <p>Foglalásod sikeresen rögzítettük. Az alábbi összefoglalóban találod a részleteket:</p>

      <div class="code-box">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">Foglalási kód</div>
        <div class="code">${bookingDetails.bookingCode}</div>
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Helyszín</span>
          <span class="info-value">${bookingDetails.locationName}</span>
        </div>
        ${bookingDetails.locationAddress ? `
        <div class="info-row">
          <span class="info-label">Cím</span>
          <span class="info-value">${bookingDetails.locationAddress}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">Dátum</span>
          <span class="info-value">${formatDate(bookingDetails.scheduledStart)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Időpont</span>
          <span class="info-value">${formatTime(bookingDetails.scheduledStart)} - ${formatTime(bookingDetails.scheduledEnd)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Szolgáltatás</span>
          <span class="info-value">${bookingDetails.serviceName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Jármű típusa</span>
          <span class="info-value">${vehicleTypeLabels[bookingDetails.vehicleType] || bookingDetails.vehicleType}</span>
        </div>
        ${bookingDetails.plateNumber ? `
        <div class="info-row">
          <span class="info-label">Rendszám</span>
          <span class="info-value">${bookingDetails.plateNumber}</span>
        </div>
        ` : ''}
        <div class="info-row price-row">
          <span class="info-label">Ár</span>
          <span class="info-value">${formatPrice(bookingDetails.price, bookingDetails.currency)}</span>
        </div>
      </div>

      <div class="warning">
        <strong>Fontos!</strong> Kérjük, érkezz meg időben a megadott helyszínre. Ha nem tudsz megjelenni, kérjük, mondsd le a foglalást legalább 2 órával az időpont előtt.
      </div>

      <p>Ha kérdésed van, keress minket bizalommal!</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} VSys Wash. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Kedves ${customerName}!

Foglalásod sikeresen rögzítettük.

Foglalási kód: ${bookingDetails.bookingCode}

Helyszín: ${bookingDetails.locationName}
${bookingDetails.locationAddress ? `Cím: ${bookingDetails.locationAddress}` : ''}
Dátum: ${formatDate(bookingDetails.scheduledStart)}
Időpont: ${formatTime(bookingDetails.scheduledStart)} - ${formatTime(bookingDetails.scheduledEnd)}
Szolgáltatás: ${bookingDetails.serviceName}
Jármű: ${vehicleTypeLabels[bookingDetails.vehicleType] || bookingDetails.vehicleType}
${bookingDetails.plateNumber ? `Rendszám: ${bookingDetails.plateNumber}` : ''}
Ár: ${formatPrice(bookingDetails.price, bookingDetails.currency)}

Fontos: Kérjük, érkezz meg időben a megadott helyszínre. Ha nem tudsz megjelenni, kérjük, mondsd le a foglalást legalább 2 órával az időpont előtt.

© ${new Date().getFullYear()} VSys Wash
    `;

    return this.sendNetworkEmail(networkId, {
      to,
      subject: `Foglalás visszaigazolás - ${bookingDetails.bookingCode}`,
      html,
      text,
    });
  }

  // Regisztráció jóváhagyva email
  async sendApprovalEmail(
    to: string,
    firstName: string,
    inviteCode: string,
  ): Promise<boolean> {
    const loginUrl = `${this.frontendUrl}/login`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .code-box { background: white; border: 2px solid #059669; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669; font-family: monospace; }
    .button { display: inline-block; background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VSys Wash</h1>
      <p>Regisztráció jóváhagyva!</p>
    </div>
    <div class="content">
      <h2>Gratulálunk, ${firstName}!</h2>
      <p>A regisztrációdat jóváhagytuk. Mostantól használhatod a VSys Wash rendszert.</p>

      <p>A bejelentkezéshez használd a meghívó kódodat:</p>
      <div class="code-box">
        <div class="code">${inviteCode}</div>
      </div>

      <p>Vagy bejelentkezhetsz a telefonszámoddal és PIN kódoddal is.</p>

      <p style="text-align: center;">
        <a href="${loginUrl}" class="button">Bejelentkezés</a>
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} VSys Wash. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: 'VSys Wash - Regisztrációd jóváhagyva!',
      html,
    });
  }
}
