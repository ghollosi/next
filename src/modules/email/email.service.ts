import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendApiKey: string;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY') || '';
    this.fromAddress = this.configService.get<string>('EMAIL_FROM_ADDRESS') || 'noreply@vsys.hu';
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME') || 'VSys Wash';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
  }

  private async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.resendApiKey) {
      this.logger.warn('RESEND_API_KEY not configured, email sending disabled');
      this.logger.debug(`Would send email to ${options.to}: ${options.subject}`);
      return false;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromAddress}>`,
          to: options.to,
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

      this.logger.log(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Email sending error: ${error}`);
      return false;
    }
  }

  // Email validációs link küldése
  async sendVerificationEmail(
    to: string,
    firstName: string,
    token: string,
  ): Promise<boolean> {
    const verifyUrl = `${this.frontendUrl}/verify?token=${token}&type=email`;

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
