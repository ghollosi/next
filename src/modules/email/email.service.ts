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
    this.logger.log(`sendNetworkEmail called for network ${networkId}, to: ${options.to}, subject: ${options.subject}`);
    const config = await this.getNetworkEmailConfig(networkId);

    if (!config) {
      this.logger.warn(`No email config found for network ${networkId}, using platform default`);
      return this.sendEmail(options);
    }

    this.logger.log(`Network email config found: provider=${config.provider}`);

    try {
      switch (config.provider) {
        case 'RESEND':
          return await this.sendViaResend(config, options);
        case 'SMTP':
          return await this.sendViaSmtp(config, options);
        case 'PLATFORM':
        default:
          this.logger.log(`Using platform email provider`);
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
    this.logger.log(`sendEmail called: to=${options.to}, subject=${options.subject}`);
    this.logger.log(`SMTP config: host=${this.smtpHost}, user=${this.smtpUser}, pass=${this.smtpPass ? '***set***' : 'not set'}`);

    // Try SMTP first if configured
    if (this.smtpHost && this.smtpUser && this.smtpPass) {
      this.logger.log(`Using Platform SMTP to send email`);
      return this.sendViaPlatformSmtp(options);
    }

    // Fall back to Resend if configured
    if (this.resendApiKey) {
      this.logger.log(`Using Platform Resend to send email`);
      return this.sendViaPlatformResend(options);
    }

    this.logger.warn('No email provider configured (SMTP or Resend), email sending disabled');
    this.logger.log(`Would send email to ${options.to}: ${options.subject}`);
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
<html lang="hu">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Foglalás visszaigazolás</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; line-height: 60px;">
                      <span style="font-size: 28px;">&#10003;</span>
                    </div>
                    <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Foglalás megerositva</h1>
                    <p style="margin: 0; font-size: 16px; color: rgba(255,255,255,0.85);">Koszonjuk a foglalast!</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px;">

              <!-- Greeting -->
              <p style="margin: 0 0 24px; font-size: 18px; color: #1e293b; line-height: 1.6;">
                Kedves <strong>${customerName}</strong>,
              </p>
              <p style="margin: 0 0 32px; font-size: 16px; color: #475569; line-height: 1.6;">
                A foglalasod sikeresen rogzitettuk. Az alabbi osszefoglaloban megtalald a reszleteket.
              </p>

              <!-- Booking Code Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Foglalasi kod</p>
                    <p style="margin: 0; font-size: 36px; font-weight: 800; color: #1e40af; letter-spacing: 6px; font-family: 'Courier New', monospace;">${bookingDetails.bookingCode}</p>
                    <p style="margin: 12px 0 0; font-size: 13px; color: #64748b;">Kerjuk, orizd meg ezt a kodot!</p>
                  </td>
                </tr>
              </table>

              <!-- Details Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; font-size: 14px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">Foglalas reszletei</p>

                    <!-- Location -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-bottom: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 14px 0; width: 40%;">
                          <span style="font-size: 14px; color: #64748b;">Helyszin</span>
                        </td>
                        <td style="padding: 14px 0; text-align: right;">
                          <span style="font-size: 15px; color: #1e293b; font-weight: 600;">${bookingDetails.locationName}</span>
                        </td>
                      </tr>
                    </table>

                    ${bookingDetails.locationAddress ? `
                    <!-- Address -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-bottom: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 14px 0; width: 40%;">
                          <span style="font-size: 14px; color: #64748b;">Cim</span>
                        </td>
                        <td style="padding: 14px 0; text-align: right;">
                          <span style="font-size: 15px; color: #1e293b; font-weight: 600;">${bookingDetails.locationAddress}</span>
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    <!-- Date -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-bottom: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 14px 0; width: 40%;">
                          <span style="font-size: 14px; color: #64748b;">Datum</span>
                        </td>
                        <td style="padding: 14px 0; text-align: right;">
                          <span style="font-size: 15px; color: #1e293b; font-weight: 600;">${formatDate(bookingDetails.scheduledStart)}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Time -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-bottom: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 14px 0; width: 40%;">
                          <span style="font-size: 14px; color: #64748b;">Idopont</span>
                        </td>
                        <td style="padding: 14px 0; text-align: right;">
                          <span style="font-size: 15px; color: #1e293b; font-weight: 600;">${formatTime(bookingDetails.scheduledStart)} - ${formatTime(bookingDetails.scheduledEnd)}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Service -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-bottom: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 14px 0; width: 40%;">
                          <span style="font-size: 14px; color: #64748b;">Szolgaltatas</span>
                        </td>
                        <td style="padding: 14px 0; text-align: right;">
                          <span style="font-size: 15px; color: #1e293b; font-weight: 600;">${bookingDetails.serviceName}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Vehicle Type -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-bottom: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 14px 0; width: 40%;">
                          <span style="font-size: 14px; color: #64748b;">Jarmu tipusa</span>
                        </td>
                        <td style="padding: 14px 0; text-align: right;">
                          <span style="font-size: 15px; color: #1e293b; font-weight: 600;">${vehicleTypeLabels[bookingDetails.vehicleType] || bookingDetails.vehicleType}</span>
                        </td>
                      </tr>
                    </table>

                    ${bookingDetails.plateNumber ? `
                    <!-- Plate Number -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-bottom: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 14px 0; width: 40%;">
                          <span style="font-size: 14px; color: #64748b;">Rendszam</span>
                        </td>
                        <td style="padding: 14px 0; text-align: right;">
                          <span style="font-size: 15px; color: #1e293b; font-weight: 700; background-color: #fef3c7; padding: 4px 10px; border-radius: 4px;">${bookingDetails.plateNumber}</span>
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    <!-- Price -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 18px 0 4px; width: 40%;">
                          <span style="font-size: 16px; color: #1e293b; font-weight: 600;">Osszesen</span>
                        </td>
                        <td style="padding: 18px 0 4px; text-align: right;">
                          <span style="font-size: 24px; color: #1e40af; font-weight: 800;">${formatPrice(bookingDetails.price, bookingDetails.currency)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Warning Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 16px 20px;">
                    <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.6;">
                      <strong style="color: #78350f;">Fontos!</strong> Kerjuk, erkezz meg idoben a megadott helyszinre. Ha nem tudsz megjelenni, kerjuk, mondsd le a foglalast legalabb 2 oraval az idopont elott.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Help Text -->
              <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6; text-align: center;">
                Ha kerdesed van, keress minket bizalommal!
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1e293b; padding: 32px 30px; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #ffffff;">Vemiax</p>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">&copy; ${new Date().getFullYear()} Vemiax. Minden jog fenntartva.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
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

  // PIN visszaállítás email (Partner és Operator)
  async sendPinResetEmail(
    to: string,
    recipientName: string,
    resetLink: string,
    portalType: 'partner' | 'operator',
  ): Promise<boolean> {
    const portalLabel = portalType === 'partner' ? 'Partner' : 'Operátor';

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
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VSys Wash</h1>
      <p>${portalLabel} PIN visszaállítás</p>
    </div>
    <div class="content">
      <h2>Kedves ${recipientName}!</h2>
      <p>PIN visszaállítási kérelmet kaptunk a fiókodhoz.</p>
      <p>Kattints az alábbi gombra az új PIN beállításához:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">PIN visszaállítása</a>
      </p>
      <p>Ha a gomb nem működik, másold be ezt a linket a böngésződbe:</p>
      <p style="word-break: break-all; color: #6b7280; font-size: 12px;">${resetLink}</p>

      <div class="warning">
        <strong>Fontos!</strong> A link 1 órán belül lejár. Ha nem te kérted a PIN visszaállítást, kérjük, hagyd figyelmen kívül ezt az emailt.
      </div>
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

PIN visszaállítási kérelmet kaptunk a fiókodhoz.

Kattints az alábbi linkre az új PIN beállításához:
${resetLink}

A link 1 órán belül lejár. Ha nem te kérted a PIN visszaállítást, kérjük, hagyd figyelmen kívül ezt az emailt.

© ${new Date().getFullYear()} VSys Wash
    `;

    return this.sendEmail({
      to,
      subject: `VSys Wash - ${portalLabel} PIN visszaállítás`,
      html,
      text,
    });
  }

  // Platform Admin jelszó visszaállítás email
  async sendPasswordResetEmail(
    to: string,
    adminName: string,
    resetLink: string,
  ): Promise<boolean> {
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
    .button { display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VSys Platform</h1>
      <p>Jelszó visszaállítás</p>
    </div>
    <div class="content">
      <h2>Kedves ${adminName}!</h2>
      <p>Jelszó visszaállítási kérelmet kaptunk a Platform Admin fiókodhoz.</p>
      <p>Kattints az alábbi gombra az új jelszó beállításához:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Jelszó visszaállítása</a>
      </p>
      <p>Ha a gomb nem működik, másold be ezt a linket a böngésződbe:</p>
      <p style="word-break: break-all; color: #6b7280; font-size: 12px;">${resetLink}</p>

      <div class="warning">
        <strong>Biztonsági figyelmeztetés!</strong> A link 1 órán belül lejár. Ha nem te kérted a jelszó visszaállítást, azonnal értesítsd a rendszergazdát, mert valaki hozzáférést próbálhatott szerezni a fiókodhoz.
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} VSys Platform. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Kedves ${adminName}!

Jelszó visszaállítási kérelmet kaptunk a Platform Admin fiókodhoz.

Kattints az alábbi linkre az új jelszó beállításához:
${resetLink}

A link 1 órán belül lejár. Ha nem te kérted a jelszó visszaállítást, azonnal értesítsd a rendszergazdát!

© ${new Date().getFullYear()} VSys Platform
    `;

    return this.sendEmail({
      to,
      subject: 'VSys Platform - Jelszó visszaállítás',
      html,
      text,
    });
  }

  // Stripe sikertelen fizetés értesítés
  async sendPaymentFailedEmail(
    to: string,
    networkName: string,
    amount: number,
    currency: string,
    retryDate?: Date,
  ): Promise<boolean> {
    const formatPrice = (price: number, curr: string) => {
      return new Intl.NumberFormat('hu-HU', {
        style: 'currency',
        currency: curr,
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
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .warning { background: #fee2e2; border: 1px solid #dc2626; border-radius: 8px; padding: 15px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VSys Platform</h1>
      <p>Fizetési hiba</p>
    </div>
    <div class="content">
      <h2>Sikertelen fizetés</h2>
      <p>Sajnos a(z) <strong>${networkName}</strong> network előfizetési díjának levonása sikertelen volt.</p>

      <div class="info-box">
        <p><strong>Összeg:</strong> ${formatPrice(amount, currency)}</p>
        ${retryDate ? `<p><strong>Következő próbálkozás:</strong> ${retryDate.toLocaleDateString('hu-HU')}</p>` : ''}
      </div>

      <div class="warning">
        <strong>Fontos!</strong> Kérjük, ellenőrizd a fizetési adataidat a Network Admin felületen, hogy elkerüld a szolgáltatás felfüggesztését.
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} VSys Platform. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: `VSys - Sikertelen fizetés: ${networkName}`,
      html,
    });
  }

  // Stripe trial lejárat figyelmeztetés
  async sendTrialEndingEmail(
    to: string,
    networkName: string,
    trialEndDate: Date,
    daysRemaining: number,
  ): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .days-box { background: white; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .days { font-size: 48px; font-weight: bold; color: #f59e0b; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VSys Platform</h1>
      <p>Trial időszak hamarosan lejár</p>
    </div>
    <div class="content">
      <h2>Kedves Network Admin!</h2>
      <p>A(z) <strong>${networkName}</strong> network próbaidőszaka hamarosan lejár.</p>

      <div class="days-box">
        <div class="days">${daysRemaining}</div>
        <div>nap van hátra</div>
      </div>

      <p><strong>Lejárat dátuma:</strong> ${trialEndDate.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <p>A szolgáltatás folytatásához kérjük, add meg a fizetési adataidat a Network Admin felületen.</p>

      <p style="text-align: center;">
        <a href="https://app.vemiax.com/network-admin/settings/billing" class="button">Előfizetés kezelése</a>
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} VSys Platform. Minden jog fenntartva.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject: `VSys - Trial lejár ${daysRemaining} napon belül: ${networkName}`,
      html,
    });
  }

  // Network Admin értesítés új törlési kérelemről
  async sendDeleteRequestNotification(
    to: string,
    adminName: string,
    driverName: string,
    requestType: string,
    details: string,
  ): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VSys Wash</h1>
      <p>Új törlési kérelem</p>
    </div>
    <div class="content">
      <h2>Kedves ${adminName}!</h2>
      <p>Új törlési kérelmet kaptunk egy sofőrtől.</p>

      <div class="info-box">
        <p><strong>Sofőr neve:</strong> ${driverName}</p>
        <p><strong>Kérelem típusa:</strong> ${requestType}</p>
        <p><strong>Részletek:</strong> ${details}</p>
        <p><strong>Dátum:</strong> ${new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      </div>

      <p>Kérjük, kezeld a kérelmet a Network Admin felületen.</p>

      <p style="text-align: center;">
        <a href="https://app.vemiax.com/network-admin/delete-requests" class="button">Törlési kérelmek megtekintése</a>
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
      subject: `VSys - Új törlési kérelem: ${driverName}`,
      html,
    });
  }
}
