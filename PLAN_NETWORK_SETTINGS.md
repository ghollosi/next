# VSys Multi-Tenant SaaS Architektúra - Implementációs Terv

## Áttekintés

A VSys egy multi-tenant SaaS rendszer, ahol minden "Network" egy önálló automosó cég/hálózat. A rendszer támogatja:
- Több pénznemet (alap + elfogadott devizák árfolyammal)
- Több ÁFA kulcsot
- Különböző számlázó integrációkat
- White-label branding lehetőséget
- Hierarchikus admin rendszert
- Előfizetéses üzleti modellt (demo + fizetős)

---

## 1. Admin Szerepkörök Hierarchia

```
PLATFORM_OWNER          - Teljes platform tulajdonos (te)
  └── PLATFORM_ADMIN    - Platform szintű adminisztrátor
        └── NETWORK_OWNER       - Egy network tulajdonosa (automosó cég)
              └── NETWORK_ADMIN       - Network adminisztrátor
              └── NETWORK_CONTROLLER  - Kontrolling (riportok, statisztikák)
              └── NETWORK_ACCOUNTANT  - Könyvelés (számlák, pénzügyek)
              └── LOCATION_MANAGER    - Telephely vezető
                    └── OPERATOR      - Kezelő (mosást végez)
```

### Jogosultságok mátrix:

| Funkció | PLATFORM_OWNER | NETWORK_OWNER | NETWORK_ADMIN | CONTROLLER | ACCOUNTANT | LOC_MANAGER | OPERATOR |
|---------|---------------|---------------|---------------|------------|------------|-------------|----------|
| Platform beállítások | ✓ | - | - | - | - | - | - |
| Árazás (SaaS díjak) | ✓ | - | - | - | - | - | - |
| Új network létrehozás | ✓ | - | - | - | - | - | - |
| Network beállítások | ✓ | ✓ | ✓ | - | - | - | - |
| Számlázó integráció | ✓ | ✓ | ✓ | - | ✓ | - | - |
| Pénzügyi riportok | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |
| Partnercégek kezelés | ✓ | ✓ | ✓ | - | - | - | - |
| Sofőrök kezelés | ✓ | ✓ | ✓ | - | - | ✓ | - |
| Telephelyek kezelés | ✓ | ✓ | ✓ | - | - | - | - |
| Mosások kezelés | ✓ | ✓ | ✓ | ✓ | - | ✓ | ✓ |
| Saját telephely | - | - | - | - | - | ✓ | ✓ |

---

## 2. Adatbázis Séma Bővítések

### 2.1 Platform szintű táblák (új)

```prisma
// Platform tulajdonos beállításai
model PlatformSettings {
  id                    String   @id @default(uuid())

  // Alap platform adatok
  platformName          String   @default("VSys Wash")
  platformUrl           String   @default("https://vsys.hu")
  supportEmail          String
  supportPhone          String?

  // SaaS árazás
  trialDays             Int      @default(14)           // Demo időszak napokban
  monthlyBasePrice      Decimal  @db.Decimal(10,2)      // Havi alapdíj
  pricePerVehicle       Decimal  @db.Decimal(10,2)      // Ár járművenként
  priceCurrency         String   @default("EUR")        // Platform pénznem

  // Modulok árazása (JSON: { "billing": 50, "api": 100 })
  modulesPricing        Json?

  updatedAt             DateTime @updatedAt

  @@map("platform_settings")
}

// Platform admin felhasználók
model PlatformAdmin {
  id            String        @id @default(uuid())
  email         String        @unique
  passwordHash  String
  name          String
  role          PlatformRole  @default(PLATFORM_ADMIN)
  isActive      Boolean       @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@map("platform_admins")
}

enum PlatformRole {
  PLATFORM_OWNER
  PLATFORM_ADMIN
}
```

### 2.2 Network Settings bővítés

```prisma
model Network {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // === ÚJ MEZŐK ===

  // Előfizetés státusz
  subscriptionStatus    SubscriptionStatus @default(TRIAL)
  trialEndsAt           DateTime?
  subscriptionStartedAt DateTime?

  // Cégadatok
  companyName           String?            // Hivatalos cégnév
  companyShortName      String?            // Rövidített név
  taxNumber             String?            // Adószám
  euVatNumber           String?            // EU VAT szám
  registrationNumber    String?            // Cégjegyzékszám

  // Cím
  addressCountry        String   @default("HU")
  addressCity           String?
  addressZip            String?
  addressStreet         String?

  // Bankszámla
  bankName              String?
  bankAccountIban       String?
  bankAccountSwift      String?

  // Lokalizáció
  timezone              String   @default("Europe/Budapest")
  locale                String   @default("hu")

  // Elérhetőség
  contactPhone          String?
  contactEmail          String?
  websiteUrl            String?

  // Branding
  logoUrl               String?
  primaryColor          String?  @default("#2563eb")
  secondaryColor        String?  @default("#1e40af")

  // Kapcsolatok
  settings              NetworkSettings?
  currencies            NetworkCurrency[]
  vatRates              NetworkVatRate[]
  admins                NetworkAdmin[]
  // ... existing relations

  @@map("networks")
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  CANCELLED
}

// Külön tábla a beállításoknak (1:1 kapcsolat)
model NetworkSettings {
  id                    String   @id @default(uuid())
  networkId             String   @unique

  // Email beállítások
  emailProvider         EmailProvider @default(PLATFORM)  // PLATFORM = közös, CUSTOM = saját
  emailApiKey           String?       // Titkosítva tárolva
  emailFromAddress      String?
  emailFromName         String?
  smtpHost              String?
  smtpPort              Int?
  smtpUser              String?
  smtpPassword          String?       // Titkosítva

  // SMS beállítások
  smsProvider           SmsProvider @default(PLATFORM)
  smsApiKey             String?       // Titkosítva
  smsApiSecret          String?       // Titkosítva
  smsFromNumber         String?

  // Számlázó integráció
  invoiceProvider       InvoiceProvider @default(MANUAL)
  invoiceApiKey         String?         // Titkosítva
  invoicePrefix         String?         // pl: "VSW-"
  invoiceNextNumber     Int      @default(1)
  invoicePaymentDays    Int      @default(8)   // Fizetési határidő

  // Üzleti szabályok
  defaultPaymentMethod  PaymentMethod @default(INVOICE)
  allowedPaymentMethods Json?         // ["CASH", "INVOICE", "CARD"]
  autoApproveDrivers    Boolean  @default(false)
  requireEmailVerification Boolean @default(true)
  requirePhoneVerification Boolean @default(false)

  // Frontend URL (white-label)
  customDomain          String?       // pl: "wash.example.com"

  network               Network  @relation(fields: [networkId], references: [id])

  @@map("network_settings")
}

enum EmailProvider {
  PLATFORM    // Platform közös Resend fiók
  RESEND
  SENDGRID
  SMTP
}

enum SmsProvider {
  PLATFORM    // Platform közös Twilio fiók
  TWILIO
  NEXMO
}

enum InvoiceProvider {
  MANUAL          // Nincs integráció, manuális
  SZAMLAZZ_HU
  BILLINGO
  NAV_ONLINE      // Csak NAV adatszolgáltatás
}

enum PaymentMethod {
  CASH
  INVOICE
  CARD
  PREPAID
}
```

### 2.3 Pénznemek kezelése

```prisma
model NetworkCurrency {
  id              String   @id @default(uuid())
  networkId       String

  currencyCode    String            // HUF, EUR, RON, PLN
  currencySymbol  String            // Ft, €, lei, zł
  isBaseCurrency  Boolean @default(false)

  // Ha nem alap pénznem, akkor átváltási szabály
  exchangeSource  ExchangeSource?   // MNB, ECB, FIXED
  exchangeRate    Decimal? @db.Decimal(10,4)  // Fix árfolyam ha FIXED
  exchangeMarkup  Decimal? @db.Decimal(5,2)   // pl: -20 = -20%

  isActive        Boolean @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  network         Network @relation(fields: [networkId], references: [id])

  @@unique([networkId, currencyCode])
  @@map("network_currencies")
}

enum ExchangeSource {
  MNB       // Magyar Nemzeti Bank
  ECB       // European Central Bank
  FIXED     // Fix árfolyam
}

// Árfolyam napló (napi frissítés)
model ExchangeRateLog {
  id            String   @id @default(uuid())
  source        ExchangeSource
  baseCurrency  String              // pl: EUR
  targetCurrency String             // pl: HUF
  rate          Decimal  @db.Decimal(10,4)
  date          DateTime @db.Date
  createdAt     DateTime @default(now())

  @@unique([source, baseCurrency, targetCurrency, date])
  @@map("exchange_rate_logs")
}
```

### 2.4 ÁFA kulcsok

```prisma
model NetworkVatRate {
  id            String   @id @default(uuid())
  networkId     String

  name          String              // "Normál", "Kedvezményes"
  rate          Decimal  @db.Decimal(5,2)  // 27.00, 5.00
  isDefault     Boolean  @default(false)
  isActive      Boolean  @default(true)

  network       Network  @relation(fields: [networkId], references: [id])

  @@map("network_vat_rates")
}
```

### 2.5 Network Admin felhasználók

```prisma
model NetworkAdmin {
  id            String       @id @default(uuid())
  networkId     String

  email         String
  passwordHash  String
  name          String
  role          NetworkRole

  // Ha LOCATION_MANAGER, melyik telephelyekhez van hozzáférése
  locationIds   String[]     // UUID array

  isActive      Boolean      @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  network       Network      @relation(fields: [networkId], references: [id])

  @@unique([networkId, email])
  @@map("network_admins")
}

enum NetworkRole {
  NETWORK_OWNER
  NETWORK_ADMIN
  NETWORK_CONTROLLER
  NETWORK_ACCOUNTANT
  LOCATION_MANAGER
}
```

---

## 3. API Végpontok

### 3.1 Platform Admin API (`/platform-admin/*`)
- `POST /login` - Platform admin bejelentkezés
- `GET /networks` - Összes network listázás
- `POST /networks` - Új network létrehozás
- `GET /networks/:id` - Network részletek
- `PUT /networks/:id/subscription` - Előfizetés módosítás
- `GET /statistics` - Platform statisztikák
- `GET /settings` - Platform beállítások
- `PUT /settings` - Platform beállítások módosítás

### 3.2 Network Setup API (`/network-admin/setup/*`)
- `GET /company` - Cégadatok lekérés
- `PUT /company` - Cégadatok módosítás
- `GET /localization` - Lokalizáció beállítások
- `PUT /localization` - Lokalizáció módosítás
- `GET /currencies` - Pénznemek listázás
- `POST /currencies` - Pénznem hozzáadás
- `PUT /currencies/:id` - Pénznem módosítás
- `GET /vat-rates` - ÁFA kulcsok listázás
- `POST /vat-rates` - ÁFA kulcs hozzáadás
- `GET /email` - Email beállítások
- `PUT /email` - Email beállítások módosítás
- `POST /email/test` - Teszt email küldés
- `GET /sms` - SMS beállítások
- `PUT /sms` - SMS beállítások módosítás
- `POST /sms/test` - Teszt SMS küldés
- `GET /invoice` - Számlázó beállítások
- `PUT /invoice` - Számlázó beállítások módosítás
- `GET /branding` - Branding beállítások
- `PUT /branding` - Branding módosítás
- `POST /branding/logo` - Logo feltöltés

### 3.3 Network Admin Management (`/network-admin/users/*`)
- `GET /` - Admin felhasználók listázás
- `POST /` - Új admin létrehozás
- `PUT /:id` - Admin módosítás
- `DELETE /:id` - Admin törlés/inaktiválás

---

## 4. Frontend Oldalak

### 4.1 Platform Admin Portal (`/platform/*`)
- `/platform/login` - Bejelentkezés
- `/platform/dashboard` - Áttekintés (bevétel, network-ök, stb.)
- `/platform/networks` - Network-ök kezelése
- `/platform/networks/:id` - Network részletek/szerkesztés
- `/platform/settings` - Platform beállítások
- `/platform/pricing` - SaaS árazás

### 4.2 Network Admin Setup Wizard (`/admin/setup/*`)
- `/admin/setup` - Setup áttekintés (checklist)
- `/admin/setup/company` - Cégadatok
- `/admin/setup/localization` - Ország, pénznem, időzóna
- `/admin/setup/currencies` - Pénznemek kezelése
- `/admin/setup/vat` - ÁFA kulcsok
- `/admin/setup/email` - Email szolgáltató
- `/admin/setup/sms` - SMS szolgáltató
- `/admin/setup/invoice` - Számlázó integráció
- `/admin/setup/branding` - Logo, színek

---

## 5. Implementációs Sorrend

### Fázis 1: Adatbázis és alap struktúra
1. [ ] Prisma schema bővítés (összes új tábla)
2. [ ] Migráció létrehozása és futtatása
3. [ ] Enum típusok és DTO-k létrehozása

### Fázis 2: Platform Admin
4. [ ] PlatformSettings service
5. [ ] Platform Admin auth (login, JWT)
6. [ ] Platform Admin API végpontok
7. [ ] Platform Admin Frontend

### Fázis 3: Network Settings
8. [ ] NetworkSettings service
9. [ ] Network currencies service (+ árfolyam lekérdezés)
10. [ ] VAT rates service
11. [ ] Network Setup API végpontok
12. [ ] Network Setup Frontend (wizard)

### Fázis 4: Email/SMS dinamikus provider
13. [ ] Email service átalakítás (provider alapján)
14. [ ] SMS service átalakítás (provider alapján)
15. [ ] Provider config titkosítás

### Fázis 5: Számlázó integrációk
16. [ ] Invoice provider interface
17. [ ] Számlázz.hu integráció
18. [ ] Billingo integráció
19. [ ] Manuális export (PDF/Excel)

### Fázis 6: Előfizetés kezelés
20. [ ] Subscription service
21. [ ] Trial lejárat kezelés
22. [ ] Fizetési emlékeztetők
23. [ ] Billing dashboard

---

## 6. Biztonsági megfontolások

1. **API kulcsok titkosítása**: AES-256 encryption a DB-ben tárolt API kulcsokhoz
2. **Platform Admin**: Külön auth rendszer, erős jelszó követelmények, 2FA
3. **Network izoláció**: Minden query-ben networkId szűrés
4. **Rate limiting**: API hívások korlátozása
5. **Audit log**: Minden beállítás változás naplózása

---

## 7. Árfolyam lekérdezés

### MNB árfolyam API
```typescript
// Napi árfolyam lekérdezés MNB-től
async function fetchMnbRates(): Promise<ExchangeRate[]> {
  const response = await fetch('https://www.mnb.hu/arfolyamok.asmx?WSDL');
  // SOAP kérés feldolgozása...
}
```

### ECB árfolyam API
```typescript
// EUR alapú árfolyamok ECB-től
async function fetchEcbRates(): Promise<ExchangeRate[]> {
  const response = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
  // XML feldolgozása...
}
```

---

## 8. Becsült komplexitás

| Fázis | Komplexitás | Megjegyzés |
|-------|-------------|------------|
| Fázis 1 | Közepes | Sok új tábla, de egyértelmű |
| Fázis 2 | Közepes | Új admin portal |
| Fázis 3 | Magas | Sok beállítás, wizard UI |
| Fázis 4 | Közepes | Provider pattern refactor |
| Fázis 5 | Magas | Külső API integrációk |
| Fázis 6 | Közepes | Előfizetés logika |

---

## Kérdések implementáció előtt

1. **Demo időszak**: 14 nap elég, vagy más?
2. **Fizetési mód**: Stripe/PayPal integráció kell, vagy manuális számlázás?
3. **White-label domain**: Subdomain (ceg.vsys.hu) vagy custom domain is?
4. **Prioritás**: Melyik fázissal kezdjük?
