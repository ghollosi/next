import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;

  constructor(private readonly configService: ConfigService) {
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID') || '';
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
    this.fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';
  }

  async sendSms(to: string, message: string): Promise<boolean> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      this.logger.warn('Twilio not configured, SMS sending disabled');
      this.logger.debug(`Would send SMS to ${to}: ${message}`);
      return false;
    }

    try {
      // Normalize phone number to E.164 format
      const normalizedTo = this.normalizePhoneNumber(to);

      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: normalizedTo,
          From: this.fromNumber,
          Body: message,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        this.logger.error(`Failed to send SMS: ${JSON.stringify(error)}`);
        return false;
      }

      this.logger.log(`SMS sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`SMS sending error: ${error}`);
      return false;
    }
  }

  // Telefonszám normalizálása E.164 formátumra
  private normalizePhoneNumber(phone: string): string {
    // Tisztítás: csak számok és + jel marad
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Ha 06-tal kezdődik (magyar), cseréljük +36-ra
    if (cleaned.startsWith('06')) {
      cleaned = '+36' + cleaned.slice(2);
    }
    // Ha nem +-szal kezdődik és 9-10 számjegy, feltételezzük magyar
    else if (!cleaned.startsWith('+') && cleaned.length >= 9 && cleaned.length <= 10) {
      cleaned = '+36' + cleaned;
    }
    // Ha nincs + az elején, adjuk hozzá
    else if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  // Validációs SMS küldése
  async sendVerificationCode(
    to: string,
    code: string,
    firstName: string,
  ): Promise<boolean> {
    const message = `VSys Wash - Kedves ${firstName}! A megerősítő kódod: ${code}\nA kód 10 percig érvényes.`;
    return this.sendSms(to, message);
  }
}
