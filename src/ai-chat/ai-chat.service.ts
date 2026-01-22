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
          ? `\n\nA FELHASZNÁLÓ: Bejelentkezett sofőr.
SEGÍTHETSZ:
- Mosófoglalás, QR kód használat
- Autók kezelése (hozzáadás, törlés)
- Mosási előzmények megtekintése
- Profil beállítások
- Számlázási adatok módosítása

FONTOS OLDALAK:
- Dashboard: /dashboard - áttekintés, aktív mosások
- Új mosás: /wash/new - QR kód szkennelése
- Járművek: /vehicles - autók kezelése
- Előzmények: /history - korábbi mosások
- Profil: /profile - adatok módosítása`
          : `\n\nUSER: Logged in driver.
CAN HELP WITH:
- Wash booking, QR code usage
- Vehicle management (add, remove)
- Viewing wash history
- Profile settings
- Billing information updates

KEY PAGES:
- Dashboard: /dashboard - overview, active washes
- New wash: /wash/new - scan QR code
- Vehicles: /vehicles - manage cars
- History: /history - past washes
- Profile: /profile - update details`;
        break;
      case 'operator':
        roleContext = isHungarian
          ? `\n\nA FELHASZNÁLÓ: Operátor egy mosóhelyszínen.
SEGÍTHETSZ:
- Mosások kezelése (indítás, befejezés, elutasítás)
- Sofőr QR kódok ellenőrzése
- Foglalások megtekintése
- Napi/havi statisztikák értelmezése
- Kézi mosás rögzítés (ha engedélyezett)

FONTOS OLDALAK:
- Dashboard: /operator-portal/dashboard - sor, statisztikák
- Új mosás: /operator-portal/new-wash - kézi rögzítés
- Foglalások: /operator-portal/bookings - mai foglalások
- Számlázás: /operator-portal/billing/* - alvállalkozói számlázás (ha van)

TIPPEK:
- A sárga kártya = folyamatban lévő mosás
- Kék = engedélyezett, várakozik
- Szürke = jóváhagyásra vár`
          : `\n\nUSER: Operator at a wash location.
CAN HELP WITH:
- Managing washes (start, complete, reject)
- Verifying driver QR codes
- Viewing bookings
- Understanding daily/monthly statistics
- Manual wash recording (if enabled)

KEY PAGES:
- Dashboard: /operator-portal/dashboard - queue, stats
- New wash: /operator-portal/new-wash - manual entry
- Bookings: /operator-portal/bookings - today's bookings
- Billing: /operator-portal/billing/* - subcontractor invoicing (if applicable)

TIPS:
- Yellow card = wash in progress
- Blue = authorized, waiting
- Gray = awaiting approval`;
        break;
      case 'partner_admin':
        roleContext = isHungarian
          ? `\n\nA FELHASZNÁLÓ: Partner admin (flottakezelő).
SEGÍTHETSZ:
- Sofőrök kezelése, hozzáadása
- PIN visszaállítási kérések kezelése
- Mosási statisztikák, kimutatások
- Számlák megtekintése, letöltése
- Exportálás (Excel)

FONTOS OLDALAK:
- Dashboard: /partner/dashboard - áttekintés, mosások listája
- Számlák: /partner/invoices - havi kimutatások

TIPPEK:
- PIN visszaállítási kérelem: ha sofőr elfelejti PIN-jét, kérelmet küld neked
- Szűrés dátum és státusz szerint működik a dashboardon
- Excel export a kijelölt időszakra`
          : `\n\nUSER: Partner admin (fleet manager).
CAN HELP WITH:
- Managing drivers, adding new ones
- Handling PIN reset requests
- Wash statistics, reports
- Viewing and downloading invoices
- Export to Excel

KEY PAGES:
- Dashboard: /partner/dashboard - overview, wash list
- Invoices: /partner/invoices - monthly statements

TIPS:
- PIN reset request: if driver forgets PIN, they request from you
- Dashboard filtering by date and status works
- Excel export for selected period`;
        break;
      case 'network_admin':
        roleContext = isHungarian
          ? `\n\nA FELHASZNÁLÓ: Network Admin (hálózat üzemeltetője).
SEGÍTHETSZ:
- Hálózat teljes kezelése
- Helyszínek (mosók) létrehozása, módosítása
- Partnerek és sofőrök kezelése
- Árlisták, szolgáltatáscsomagok beállítása
- Számlázási beállítások
- Operátorok létrehozása
- Riportok és statisztikák
- Előfizetés kezelése

FONTOS OLDALAK:
- Dashboard: /network-admin/dashboard - áttekintés
- Helyszínek: /network-admin/locations - mosók kezelése
- Partnerek: /network-admin/partners - partnerek
- Sofőrök: /network-admin/drivers - sofőrök jóváhagyása
- Árlista: /network-admin/prices - árak beállítása
- Riportok: /network-admin/reports - statisztikák
- Beállítások: /network-admin/settings - hálózat beállítások
- Előfizetés: /network-admin/subscription - terv kezelése

TIPPEK:
- Új helyszín: Helyszínek -> Új helyszín gomb
- Sofőr jóváhagyás: Sofőrök menüben "Függőben" státuszúak
- Trial: 14 napos próbaidőszak, utána előfizetés szükséges
- QR kód: minden helyszínhez generálható egyedi QR`
          : `\n\nUSER: Network Admin (network operator).
CAN HELP WITH:
- Full network management
- Creating and modifying locations (washes)
- Managing partners and drivers
- Setting up price lists, service packages
- Billing settings
- Creating operators
- Reports and statistics
- Subscription management

KEY PAGES:
- Dashboard: /network-admin/dashboard - overview
- Locations: /network-admin/locations - wash management
- Partners: /network-admin/partners - partners
- Drivers: /network-admin/drivers - driver approval
- Prices: /network-admin/prices - pricing setup
- Reports: /network-admin/reports - statistics
- Settings: /network-admin/settings - network settings
- Subscription: /network-admin/subscription - plan management

TIPS:
- New location: Locations -> New location button
- Driver approval: In Drivers menu, "Pending" status
- Trial: 14-day trial, subscription required after
- QR code: unique QR can be generated for each location`;
        break;
      case 'platform_admin':
        roleContext = isHungarian
          ? `\n\nA FELHASZNÁLÓ: Platform Admin (teljes rendszer felett).
SEGÍTHETSZ:
- Minden hálózat áttekintése és kezelése
- Új hálózatok létrehozása
- Globális beállítások
- Audit napló megtekintése
- Platform szintű számlázás
- Adminisztrátorok kezelése

FONTOS OLDALAK:
- Dashboard: /platform-admin/dashboard - globális áttekintés
- Hálózatok: /platform-admin/networks - összes hálózat
- Audit napló: /platform-admin/audit-logs - rendszer események
- Számlázás: /platform-admin/billing - platform számlázás
- Adminok: /platform-admin/admins - platform adminok
- Beállítások: /platform-admin/settings - globális config

SPECIÁLIS FUNKCIÓK:
- "View as Network" gomb: bármely hálózat megtekintése Network Admin nézetben
- Trial meghosszabbítás: Networks -> hálózat kiválasztása
- Hálózat deaktiválás/aktiválás: Networks oldalon`
          : `\n\nUSER: Platform Admin (full system access).
CAN HELP WITH:
- Viewing and managing all networks
- Creating new networks
- Global settings
- Viewing audit logs
- Platform-level billing
- Managing administrators

KEY PAGES:
- Dashboard: /platform-admin/dashboard - global overview
- Networks: /platform-admin/networks - all networks
- Audit logs: /platform-admin/audit-logs - system events
- Billing: /platform-admin/billing - platform billing
- Admins: /platform-admin/admins - platform admins
- Settings: /platform-admin/settings - global config

SPECIAL FEATURES:
- "View as Network" button: view any network as Network Admin
- Trial extension: Networks -> select network
- Network activate/deactivate: on Networks page`;
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
        max_tokens: 1024, // Allow detailed responses for data-rich queries
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

      // For network admin - their network's data including wash stats and financials
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

        // Today's wash stats
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayWashes = await this.prisma.washEvent.count({
          where: { networkId: context.networkId, createdAt: { gte: todayStart } },
        });
        const todayCompleted = await this.prisma.washEvent.count({
          where: { networkId: context.networkId, createdAt: { gte: todayStart }, status: 'COMPLETED' },
        });
        const todayInProgress = await this.prisma.washEvent.count({
          where: { networkId: context.networkId, createdAt: { gte: todayStart }, status: 'IN_PROGRESS' },
        });

        // Monthly wash stats
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const monthlyWashes = await this.prisma.washEvent.count({
          where: { networkId: context.networkId, createdAt: { gte: monthStart } },
        });
        const monthlyCompleted = await this.prisma.washEvent.count({
          where: { networkId: context.networkId, createdAt: { gte: monthStart }, status: 'COMPLETED' },
        });

        // Monthly revenue (sum of finalPrice for completed washes)
        const monthlyRevenue = await this.prisma.washEvent.aggregate({
          where: {
            networkId: context.networkId,
            createdAt: { gte: monthStart },
            status: 'COMPLETED',
            finalPrice: { not: null },
          },
          _sum: { finalPrice: true },
        });

        // Today's revenue
        const todayRevenue = await this.prisma.washEvent.aggregate({
          where: {
            networkId: context.networkId,
            createdAt: { gte: todayStart },
            status: 'COMPLETED',
            finalPrice: { not: null },
          },
          _sum: { finalPrice: true },
        });

        // All-time total washes
        const totalWashes = await this.prisma.washEvent.count({
          where: { networkId: context.networkId },
        });
        const totalCompleted = await this.prisma.washEvent.count({
          where: { networkId: context.networkId, status: 'COMPLETED' },
        });

        // All-time revenue
        const totalRevenue = await this.prisma.washEvent.aggregate({
          where: {
            networkId: context.networkId,
            status: 'COMPLETED',
            finalPrice: { not: null },
          },
          _sum: { finalPrice: true },
        });

        // Per-location breakdown (top locations this month)
        const locationBreakdown = await this.prisma.washEvent.groupBy({
          by: ['locationId'],
          where: {
            networkId: context.networkId,
            createdAt: { gte: monthStart },
            status: 'COMPLETED',
          },
          _count: true,
          _sum: { finalPrice: true },
          orderBy: { _count: { locationId: 'desc' } },
          take: 5,
        });

        // Get location names for breakdown
        let locationDetails = '';
        if (locationBreakdown.length > 0) {
          const locationIds = locationBreakdown.map(l => l.locationId);
          const locationsForBreakdown = await this.prisma.location.findMany({
            where: { id: { in: locationIds } },
            select: { id: true, name: true },
          });
          const locationMap = new Map(locationsForBreakdown.map(l => [l.id, l.name]));

          locationDetails = locationBreakdown
            .map(l => {
              const name = locationMap.get(l.locationId) || 'Ismeretlen';
              const revenue = l._sum?.finalPrice ? Number(l._sum.finalPrice).toLocaleString() : '0';
              return isHungarian
                ? `  - ${name}: ${l._count} mosás, ${revenue} ${network?.defaultCurrency || 'HUF'} bevétel`
                : `  - ${name}: ${l._count} washes, ${revenue} ${network?.defaultCurrency || 'HUF'} revenue`;
            })
            .join('\n');
        }

        // Fetch ALL locations with full details for the network
        const allLocations = await this.prisma.location.findMany({
          where: { networkId: context.networkId, isActive: true },
          select: {
            name: true,
            code: true,
            address: true,
            city: true,
            zipCode: true,
            country: true,
            locationType: true,
            washMode: true,
            operationType: true,
            visibility: true,
            bookingEnabled: true,
            parallelSlots: true,
            phone: true,
            email: true,
            openingHoursStructured: {
              select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
              orderBy: { dayOfWeek: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        });

        const dayNames: Record<string, { hu: string; en: string }> = {
          MONDAY: { hu: 'Hétfő', en: 'Monday' },
          TUESDAY: { hu: 'Kedd', en: 'Tuesday' },
          WEDNESDAY: { hu: 'Szerda', en: 'Wednesday' },
          THURSDAY: { hu: 'Csütörtök', en: 'Thursday' },
          FRIDAY: { hu: 'Péntek', en: 'Friday' },
          SATURDAY: { hu: 'Szombat', en: 'Saturday' },
          SUNDAY: { hu: 'Vasárnap', en: 'Sunday' },
        };

        const locationFullDetails = allLocations.map(loc => {
          const typeLabel = isHungarian
            ? (loc.locationType === 'TRUCK_WASH' ? 'Kamionmosó' : 'Autómosó')
            : (loc.locationType === 'TRUCK_WASH' ? 'Truck Wash' : 'Car Wash');
          const modeLabel = isHungarian
            ? (loc.washMode === 'MANUAL' ? 'Személyzetes' : 'Automata')
            : (loc.washMode === 'MANUAL' ? 'Manual (staffed)' : 'Automatic');
          const operationLabel = isHungarian
            ? (loc.operationType === 'OWN' ? 'Saját üzemeltetés' : 'Alvállalkozó')
            : (loc.operationType === 'OWN' ? 'Own operation' : 'Subcontractor');
          const visibilityLabel = isHungarian
            ? (loc.visibility === 'PUBLIC' ? 'Publikus' : loc.visibility === 'NETWORK_ONLY' ? 'Csak hálózat' : 'Dedikált')
            : (loc.visibility === 'PUBLIC' ? 'Public' : loc.visibility === 'NETWORK_ONLY' ? 'Network only' : 'Dedicated');

          const address = [loc.zipCode, loc.city, loc.address].filter(Boolean).join(', ');

          let openingHoursStr = '';
          if (loc.openingHoursStructured && loc.openingHoursStructured.length > 0) {
            openingHoursStr = loc.openingHoursStructured
              .map(oh => {
                const dayName = isHungarian ? dayNames[oh.dayOfWeek]?.hu : dayNames[oh.dayOfWeek]?.en;
                if (oh.isClosed) return `    ${dayName}: ${isHungarian ? 'Zárva' : 'Closed'}`;
                return `    ${dayName}: ${oh.openTime} - ${oh.closeTime}`;
              })
              .join('\n');
          } else {
            openingHoursStr = isHungarian ? '    Nincs megadva' : '    Not specified';
          }

          if (isHungarian) {
            return `  ${loc.name} (${loc.code}):\n` +
              `    Cím: ${address || 'Nincs megadva'}\n` +
              `    Típus: ${typeLabel}\n` +
              `    Üzemmód: ${modeLabel}\n` +
              `    Üzemeltetés: ${operationLabel}\n` +
              `    Láthatóság: ${visibilityLabel}\n` +
              `    Foglalás: ${loc.bookingEnabled ? `Engedélyezve (${loc.parallelSlots} párhuzamos)` : 'Nincs'}\n` +
              (loc.phone ? `    Telefon: ${loc.phone}\n` : '') +
              (loc.email ? `    Email: ${loc.email}\n` : '') +
              `    Nyitvatartás:\n${openingHoursStr}`;
          } else {
            return `  ${loc.name} (${loc.code}):\n` +
              `    Address: ${address || 'Not specified'}\n` +
              `    Type: ${typeLabel}\n` +
              `    Mode: ${modeLabel}\n` +
              `    Operation: ${operationLabel}\n` +
              `    Visibility: ${visibilityLabel}\n` +
              `    Booking: ${loc.bookingEnabled ? `Enabled (${loc.parallelSlots} parallel)` : 'Disabled'}\n` +
              (loc.phone ? `    Phone: ${loc.phone}\n` : '') +
              (loc.email ? `    Email: ${loc.email}\n` : '') +
              `    Opening hours:\n${openingHoursStr}`;
          }
        }).join('\n\n');

        const currency = network?.defaultCurrency || 'HUF';
        const todayRev = todayRevenue._sum?.finalPrice ? Number(todayRevenue._sum.finalPrice).toLocaleString() : '0';
        const monthlyRev = monthlyRevenue._sum?.finalPrice ? Number(monthlyRevenue._sum.finalPrice).toLocaleString() : '0';
        const totalRev = totalRevenue._sum?.finalPrice ? Number(totalRevenue._sum.finalPrice).toLocaleString() : '0';

        if (network) {
          dynamicInfo = isHungarian
            ? `\n\nHÁLÓZATOD ADATAI (${network.name}):\n` +
              `ÁLTALÁNOS:\n- Helyszínek: ${locationCount}\n- Aktív sofőrök: ${driverCount}\n- Partnerek: ${partnerCount}\n- Pénznem: ${currency}\n\n` +
              `MAI STATISZTIKA:\n- Mai mosások: ${todayWashes}\n- Befejezett ma: ${todayCompleted}\n- Folyamatban: ${todayInProgress}\n- Mai bevétel: ${todayRev} ${currency}\n\n` +
              `HAVI STATISZTIKA (aktuális hónap):\n- Havi mosások: ${monthlyWashes}\n- Befejezett: ${monthlyCompleted}\n- Havi bevétel: ${monthlyRev} ${currency}\n\n` +
              `ÖSSZESÍTÉS (minden idők):\n- Összes mosás: ${totalWashes}\n- Összes befejezett: ${totalCompleted}\n- Összes bevétel: ${totalRev} ${currency}` +
              (locationDetails ? `\n\nHELYSZÍNEK HAVI BONTÁSBAN (TOP 5):\n${locationDetails}` : '') +
              `\n\nHELYSZÍNEK RÉSZLETES ADATAI:\n${locationFullDetails}`
            : `\n\nYOUR NETWORK DATA (${network.name}):\n` +
              `GENERAL:\n- Locations: ${locationCount}\n- Active drivers: ${driverCount}\n- Partners: ${partnerCount}\n- Currency: ${currency}\n\n` +
              `TODAY'S STATS:\n- Today's washes: ${todayWashes}\n- Completed today: ${todayCompleted}\n- In progress: ${todayInProgress}\n- Today's revenue: ${todayRev} ${currency}\n\n` +
              `MONTHLY STATS (current month):\n- Monthly washes: ${monthlyWashes}\n- Completed: ${monthlyCompleted}\n- Monthly revenue: ${monthlyRev} ${currency}\n\n` +
              `ALL-TIME TOTALS:\n- Total washes: ${totalWashes}\n- Total completed: ${totalCompleted}\n- Total revenue: ${totalRev} ${currency}` +
              (locationDetails ? `\n\nLOCATION BREAKDOWN (TOP 5 THIS MONTH):\n${locationDetails}` : '') +
              `\n\nLOCATION DETAILS:\n${locationFullDetails}`;
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

      // For operator - their location's data
      if (context.role === 'operator' && context.locationId) {
        const location = await this.prisma.location.findUnique({
          where: { id: context.locationId },
          select: { name: true, code: true, washMode: true },
        });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayWashes = await this.prisma.washEvent.count({
          where: {
            locationId: context.locationId,
            createdAt: { gte: todayStart },
          },
        });

        const completedToday = await this.prisma.washEvent.count({
          where: {
            locationId: context.locationId,
            createdAt: { gte: todayStart },
            status: 'COMPLETED',
          },
        });

        if (location) {
          dynamicInfo = isHungarian
            ? `\n\nHELYSZÍNED ADATAI (${location.name}):\n- Kód: ${location.code}\n- Üzemmód: ${location.washMode === 'MANUAL' ? 'Személyzetes' : 'Automata'}\n- Mai mosások: ${todayWashes}\n- Befejezett ma: ${completedToday}`
            : `\n\nYOUR LOCATION DATA (${location.name}):\n- Code: ${location.code}\n- Mode: ${location.washMode === 'MANUAL' ? 'Manual' : 'Automatic'}\n- Today's washes: ${todayWashes}\n- Completed today: ${completedToday}`;
        }
      }

      // For partner admin - their company's data
      if (context.role === 'partner_admin' && context.partnerId) {
        const partner = await this.prisma.partnerCompany.findUnique({
          where: { id: context.partnerId },
          select: { name: true, code: true },
        });

        const driverCount = await this.prisma.driver.count({
          where: { partnerCompanyId: context.partnerId, isActive: true, deletedAt: null },
        });

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const monthlyWashes = await this.prisma.washEvent.count({
          where: {
            driver: { partnerCompanyId: context.partnerId },
            createdAt: { gte: monthStart },
            status: 'COMPLETED',
          },
        });

        if (partner) {
          dynamicInfo = isHungarian
            ? `\n\nCÉGED ADATAI (${partner.name}):\n- Kód: ${partner.code}\n- Aktív sofőrök: ${driverCount}\n- Havi mosások: ${monthlyWashes}`
            : `\n\nYOUR COMPANY DATA (${partner.name}):\n- Code: ${partner.code}\n- Active drivers: ${driverCount}\n- Monthly washes: ${monthlyWashes}`;
        }
      }

      // For platform admin - global stats
      if (context.role === 'platform_admin') {
        const networkCount = await this.prisma.network.count({ where: { isActive: true } });
        const locationCount = await this.prisma.location.count({ where: { isActive: true } });
        const driverCount = await this.prisma.driver.count({ where: { isActive: true, deletedAt: null } });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayWashes = await this.prisma.washEvent.count({
          where: { createdAt: { gte: todayStart } },
        });

        dynamicInfo = isHungarian
          ? `\n\nPLATFORM ADATOK:\n- Aktív hálózatok: ${networkCount}\n- Helyszínek: ${locationCount}\n- Sofőrök: ${driverCount}\n- Mai mosások (globális): ${todayWashes}`
          : `\n\nPLATFORM DATA:\n- Active networks: ${networkCount}\n- Locations: ${locationCount}\n- Drivers: ${driverCount}\n- Today's washes (global): ${todayWashes}`;
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

    // Pricing question (only match when asking about prices specifically, not "mennyi sofőr" etc.)
    if (lowerMessage.match(/(mennyibe|ár|árak|árlista|price|pricing|cost|díj|tarifa)/) && !lowerMessage.match(/(sofőr|driver|mosás|wash|helyszín|location|partner)/)) {
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
