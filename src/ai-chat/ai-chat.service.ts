import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

// User context types for role-based access
export type UserRole = 'guest' | 'driver' | 'operator' | 'partner_admin' | 'network_admin' | 'platform_admin';

export interface ChatContext {
  role: UserRole;
  userId?: string;
  networkId?: string;
  partnerId?: string;
  locationId?: string;
  language: 'hu' | 'en';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private anthropic: Anthropic | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Anthropic API initialized');
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not configured - AI chat will be disabled');
    }
  }

  // Check if AI chat is available
  isAvailable(): boolean {
    return this.anthropic !== null;
  }

  // Get system prompt based on user role and context
  private getSystemPrompt(context: ChatContext): string {
    const isHungarian = context.language === 'hu';

    const basePrompt = isHungarian ? `
Te Émi vagy, a vSys Wash platform AI asszisztense.

SZEMÉLYISÉGED:
- Tegeződsz, kedves és segítőkész vagy
- Rövid, lényegre törő válaszokat adsz (max 2-3 mondat, kivéve ha részletes magyarázat kell)
- Ha nem tudod a választ, őszintén megmondod
- Kicsit humoros lehetsz, de nem erőltetett
- Magyar vagy, de érted az angol szavakat is
- Mindig pozitív és bátorító hangnemben beszélsz

A VSYS WASH PLATFORMRÓL:
A vSys Wash egy modern, felhőalapú autómosó menedzsment rendszer. Főbb jellemzők:
- Többhálózatos (multi-tenant) rendszer - minden mosóhálózat független
- Sofőr alkalmazás QR kódos bejelentkezéssel
- Operátor portál a mosóhelyszíneken
- Partner portál flottakezelőknek
- Network Admin felület hálózat kezeléshez
- Platform Admin a teljes rendszer felett
- Valós idejű foglalási rendszer
- Automatikus számlázás és riportok

REGISZTRÁCIÓ:
Bárki regisztrálhat az app.vemiax.com/register oldalon! Két típus van:
1. PRIVÁT ÜGYFÉL: Ha magad fizeted a mosásokat. Email + jelszó + számlázási adatok kellenek. Azonnali hozzáférést kapsz!
2. CÉGES SOFŐR: Ha egy flottához tartozol és a céged fizet. Ki kell választanod a cégedet a listából.
A regisztráció után email címmel és jelszóval tudsz bejelentkezni.

KORLÁTOZÁSOK:
- NEM adhatsz ki személyes adatokat (email, telefon, jelszó)
- NEM tudsz műveletet végrehajtani (foglalás, törlés, módosítás)
- Csak tájékoztatni tudsz, nem cselekedni
- Ha bizonytalan vagy, ajánld fel hogy forduljon a support-hoz: info@vemiax.com
` : `
You are Amy, the AI assistant for the vSys Wash platform.

PERSONALITY:
- You're friendly, helpful, and use casual language
- Keep responses short and to the point (2-3 sentences max, unless detailed explanation needed)
- Be honest when you don't know something
- Light humor is okay, but don't force it
- Always positive and encouraging

ABOUT VSYS WASH:
vSys Wash is a modern, cloud-based car wash management system. Key features:
- Multi-tenant system - each wash network is independent
- Driver app with QR code login
- Operator portal for wash locations
- Partner portal for fleet managers
- Network Admin for network management
- Platform Admin for full system control
- Real-time booking system
- Automatic invoicing and reports

REGISTRATION:
Anyone can register at app.vemiax.com/register! Two types:
1. PRIVATE CUSTOMER: If you pay for washes yourself. Need email + password + billing info. Instant access!
2. FLEET DRIVER: If you belong to a fleet and your company pays. Select your company from the list.
After registration, you can log in with email and password.

RESTRICTIONS:
- DO NOT share personal data (email, phone, passwords)
- You CANNOT perform actions (booking, deletion, modification)
- You can only inform, not act
- If unsure, suggest contacting support: info@vemiax.com
`;

    // Add role-specific context
    let roleContext = '';

    switch (context.role) {
      case 'guest':
        roleContext = isHungarian
          ? '\n\nA FELHASZNÁLÓ: Vendég (nem bejelentkezett). Csak általános információkat adhatsz a platformról, árakról, funkciókról.'
          : '\n\nUSER: Guest (not logged in). Only provide general information about the platform, pricing, features.';
        break;
      case 'driver':
        roleContext = isHungarian
          ? '\n\nA FELHASZNÁLÓ: Bejelentkezett sofőr. Segíthetsz a mosófoglalással, QR kód használattal, autók kezelésével kapcsolatban.'
          : '\n\nUSER: Logged in driver. Help with wash booking, QR code usage, vehicle management.';
        break;
      case 'operator':
        roleContext = isHungarian
          ? '\n\nA FELHASZNÁLÓ: Operátor egy mosóhelyszínen. Segíthetsz a mosások rögzítésével, sofőrök ellenőrzésével kapcsolatban.'
          : '\n\nUSER: Operator at a wash location. Help with recording washes, verifying drivers.';
        break;
      case 'partner_admin':
        roleContext = isHungarian
          ? '\n\nA FELHASZNÁLÓ: Partner admin (flottakezelő). Segíthetsz sofőrök kezelésével, számlák megtekintésével kapcsolatban.'
          : '\n\nUSER: Partner admin (fleet manager). Help with driver management, invoice viewing.';
        break;
      case 'network_admin':
        roleContext = isHungarian
          ? '\n\nA FELHASZNÁLÓ: Network Admin. Segíthetsz a hálózat kezelésével, helyszínek, partnerek, árak beállításával.'
          : '\n\nUSER: Network Admin. Help with network management, locations, partners, pricing setup.';
        break;
      case 'platform_admin':
        roleContext = isHungarian
          ? '\n\nA FELHASZNÁLÓ: Platform Admin. Teljes hozzáférés - segíthetsz bármilyen admin funkcióval.'
          : '\n\nUSER: Platform Admin. Full access - help with any admin function.';
        break;
    }

    return basePrompt + roleContext;
  }

  // Main chat method
  async chat(
    message: string,
    context: ChatContext,
    conversationHistory: ChatMessage[] = [],
  ): Promise<string> {
    if (!this.anthropic) {
      return context.language === 'hu'
        ? 'Sajnálom, az AI asszisztens jelenleg nem elérhető. Kérlek írj nekünk: info@vemiax.com'
        : 'Sorry, the AI assistant is currently unavailable. Please contact us: info@vemiax.com';
    }

    try {
      // Build message history for context
      const messages: Anthropic.MessageParam[] = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add current message
      messages.push({
        role: 'user',
        content: message,
      });

      // Fetch dynamic data based on context if needed
      const dynamicContext = await this.getDynamicContext(context);
      const systemPrompt = this.getSystemPrompt(context) + dynamicContext;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307', // Using Haiku for fast, cheap responses
        max_tokens: 500, // Keep responses concise
        system: systemPrompt,
        messages,
      });

      // Extract text response
      const textContent = response.content.find(block => block.type === 'text');
      if (textContent && textContent.type === 'text') {
        this.logger.debug(`AI response generated for ${context.role}`);
        return textContent.text;
      }

      return context.language === 'hu'
        ? 'Hmm, nem tudtam választ generálni. Próbáld újra!'
        : 'Hmm, I couldn\'t generate a response. Please try again!';

    } catch (error) {
      this.logger.error('AI chat error:', error);
      return context.language === 'hu'
        ? 'Hoppá, valami hiba történt! Kérlek próbáld újra később.'
        : 'Oops, something went wrong! Please try again later.';
    }
  }

  // Get dynamic data from database based on context
  private async getDynamicContext(context: ChatContext): Promise<string> {
    const isHungarian = context.language === 'hu';
    let dynamicInfo = '';

    try {
      // For guests - general platform stats
      if (context.role === 'guest') {
        const networkCount = await this.prisma.network.count({ where: { isActive: true } });
        const locationCount = await this.prisma.location.count({ where: { isActive: true } });

        dynamicInfo = isHungarian
          ? `\n\nAKTUÁLIS PLATFORM ADATOK:\n- Aktív hálózatok száma: ${networkCount}\n- Mosóhelyszínek száma: ${locationCount}`
          : `\n\nCURRENT PLATFORM DATA:\n- Active networks: ${networkCount}\n- Wash locations: ${locationCount}`;
      }

      // For network admin - their network's data
      if (context.role === 'network_admin' && context.networkId) {
        const network = await this.prisma.network.findUnique({
          where: { id: context.networkId },
          select: { name: true, defaultCurrency: true },
        });
        const locationCount = await this.prisma.location.count({
          where: { networkId: context.networkId, isActive: true },
        });
        const driverCount = await this.prisma.driver.count({
          where: { networkId: context.networkId, isActive: true, deletedAt: null },
        });
        const partnerCount = await this.prisma.partnerCompany.count({
          where: { networkId: context.networkId, isActive: true },
        });

        if (network) {
          dynamicInfo = isHungarian
            ? `\n\nHÁLÓZATOD ADATAI (${network.name}):\n- Helyszínek: ${locationCount}\n- Aktív sofőrök: ${driverCount}\n- Partnerek: ${partnerCount}\n- Pénznem: ${network.defaultCurrency}`
            : `\n\nYOUR NETWORK DATA (${network.name}):\n- Locations: ${locationCount}\n- Active drivers: ${driverCount}\n- Partners: ${partnerCount}\n- Currency: ${network.defaultCurrency}`;
        }
      }

      // For driver - their bookings count
      if (context.role === 'driver' && context.userId) {
        const washCount = await this.prisma.washEvent.count({
          where: { driverId: context.userId },
        });

        dynamicInfo = isHungarian
          ? `\n\nA TE ADATAID:\n- Összes mosásod: ${washCount}`
          : `\n\nYOUR DATA:\n- Total washes: ${washCount}`;
      }

    } catch (error) {
      this.logger.warn('Failed to fetch dynamic context:', error);
    }

    return dynamicInfo;
  }

  // Quick FAQ responses for common questions (to save API calls)
  getQuickResponse(message: string, language: 'hu' | 'en'): string | null {
    const lowerMessage = message.toLowerCase();
    const isHu = language === 'hu';

    // Greeting
    if (lowerMessage.match(/^(szia|hello|hi|hey|üdv|helló)/)) {
      return isHu
        ? 'Szia! Émi vagyok, a vSys Wash asszisztense. Miben segíthetek? 🚗✨'
        : 'Hi! I\'m Amy, the vSys Wash assistant. How can I help you? 🚗✨';
    }

    // Pricing question
    if (lowerMessage.match(/(mennyi|ár|árak|price|pricing|cost)/)) {
      return isHu
        ? 'Az árak a hálózattól és mosótípustól függnek. Általában a szolgáltatók határozzák meg. Ha sofőr vagy, az alkalmazásban látod az aktuális árakat a helyszín kiválasztása után!'
        : 'Prices depend on the network and wash type. Generally set by service providers. If you\'re a driver, you can see current prices in the app after selecting a location!';
    }

    // How to register
    if (lowerMessage.match(/(regisztr|register|hogyan kezd|how to start|sign up|fiók|account)/)) {
      return isHu
        ? 'Regisztrálni az app.vemiax.com/register oldalon tudsz! Válaszd ki: 1) Privát ügyfél - ha magad fizetsz 2) Céges sofőr - ha a munkahelyed fizet. Email címmel és jelszóval tudsz majd belépni!'
        : 'You can register at app.vemiax.com/register! Choose: 1) Private customer - if you pay yourself 2) Fleet driver - if your company pays. You can log in with email and password!';
    }

    // Contact
    if (lowerMessage.match(/(kapcsolat|contact|email|support|segítség kell)/)) {
      return isHu
        ? 'Bármilyen kérdéssel fordulhatsz hozzánk: info@vemiax.com - Igyekszünk gyorsan válaszolni! 📧'
        : 'For any questions, contact us: info@vemiax.com - We try to respond quickly! 📧';
    }

    return null; // No quick response, use AI
  }
}
