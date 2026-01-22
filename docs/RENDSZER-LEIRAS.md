# VSys Wash - Teljes Rendszerleírás

> **Verzió:** 2026-01-22
> **Állapot:** Egységes email+jelszó authentikáció implementálva

---

## TARTALOMJEGYZÉK

1. [Rendszer Áttekintés](#1-rendszer-áttekintés)
2. [Felhasználói Szintek és Funkciók](#2-felhasználói-szintek-és-funkciók)
3. [Authentikáció és Belépési Módok](#3-authentikáció-és-belépési-módok)
4. [Adatbázis Struktúra és Kapcsolatok](#4-adatbázis-struktúra-és-kapcsolatok)
5. [Mosás Regisztrálási Folyamatok](#5-mosás-regisztrálási-folyamatok)
6. [Foglalási Rendszer](#6-foglalási-rendszer)
7. [Számlázási Rendszer](#7-számlázási-rendszer)
8. [Email és Értesítési Rendszer](#8-email-és-értesítési-rendszer)
9. [Külső Szolgáltatók Integrációja](#9-külső-szolgáltatók-integrációja)
10. [Beállítási Lehetőségek](#10-beállítási-lehetőségek)
11. [Biztonsági Funkciók](#11-biztonsági-funkciók)
12. [API Végpontok](#12-api-végpontok)
13. [Frontend Struktúra](#13-frontend-struktúra)

---

## 1. RENDSZER ÁTTEKINTÉS

### Mi a VSys Wash?

A **VSys Wash** egy többhálózatos (multi-tenant) autómosó menedzsment SaaS rendszer, amely lehetővé teszi:

- Több független mosóhálózat kezelését egyetlen platformon
- Partner cégek és sofőrjeik menedzselését
- Mosóhelyszínek és operátorok irányítását
- Foglalások és mosások teljes körű nyilvántartását
- Automatizált számlázást és elszámolást

### Technológiai Stack

| Komponens | Technológia |
|-----------|-------------|
| **Backend** | NestJS + TypeScript |
| **Adatbázis** | PostgreSQL 16 + Prisma ORM |
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS |
| **Infrastruktúra** | Docker + Hetzner VPS + Caddy |
| **Email** | SMTP + Resend API |
| **Fizetés** | Stripe (előkészítve) |

### Főbb URL-ek

| Szolgáltatás | URL |
|--------------|-----|
| PWA Frontend | https://app.vemiax.com |
| API Backend | https://api.vemiax.com |

---

## 2. FELHASZNÁLÓI SZINTEK ÉS FUNKCIÓK

### 2.1 Platform Admin (Platformgazda)

**Leírás:** A teljes VSys platform szuperadminisztrátora.

**Hozzáférés:** `/platform-admin`

**Funkciók:**
- Új hálózatok (Networks) létrehozása és kezelése
- Platform adminisztrátorok kezelése
- Audit logok megtekintése (minden hálózat)
- Platform szintű számlázás kezelése
- Rendszerbeállítások módosítása

**Jogosultságok:**
- Minden hálózat adatainak megtekintése
- Hálózatok aktiválása/felfüggesztése
- Előfizetési státuszok módosítása

---

### 2.2 Network Admin (Hálózati Adminisztrátor)

**Leírás:** Egy mosóhálózat teljes körű kezelője.

**Hozzáférés:** `/network-admin`

**Funkciók:**
- Helyszínek (Locations) létrehozása és kezelése
- Partner cégek menedzselése
- Sofőrök jóváhagyása és kezelése
- Operátorok hozzárendelése helyszínekhez
- Árazás és szolgáltatáscsomagok beállítása
- Hálózati beállítások (email, SMS, számlázás)
- Statisztikák és riportok
- Előfizetés kezelése

**Jogosultságok:**
- Csak saját hálózat adataihoz fér hozzá
- Nem látja más hálózatok adatait
- Teljes CRUD jogosultság saját hálózaton belül

---

### 2.3 Partner Admin (Partner Adminisztrátor)

**Leírás:** Egy partner cég (pl. fuvarozó cég) adminisztrátora.

**Hozzáférés:** `/partner`

**Funkciók:**
- Saját sofőrök listázása és kezelése
- PIN visszaállítási kérelmek kezelése
- Mosások és számlák megtekintése
- Partner statisztikák
- Sofőr aktiválás/deaktiválás

**Jogosultságok:**
- Csak saját partner cég adataihoz fér hozzá
- Sofőröket nem tud létrehozni (azt az admin teszi)
- Számlákat nem módosíthatja

---

### 2.4 Location Operator (Helyszíni Operátor)

**Leírás:** A mosóhelyszínen dolgozó munkatárs.

**Hozzáférés:** `/operator-portal`

**Funkciók:**
- Mosások regisztrálása (manuális vagy QR)
- Mosási sor (queue) kezelése
- Mosások státuszának módosítása
- Foglalások kezelése az adott napra
- Blokkolási időszakok beállítása
- Napi statisztikák megtekintése
- Rendszám alapú partner keresés

**Jogosultságok:**
- Csak saját helyszín adataihoz fér hozzá
- Mosásokat nem törölhet (csak törlés kérelem)
- Árakat nem módosíthat

---

### 2.5 Driver (Sofőr)

**Leírás:** A mosószolgáltatást igénybe vevő sofőr.

**Hozzáférés:** `/login` (PWA)

**Funkciók:**
- QR kód beolvasás mosáshoz
- Foglalás létrehozása
- Mosási előzmények megtekintése
- Járművek kezelése
- Profil szerkesztése
- Számlák letöltése (magánszemély esetén)

**Típusok:**
- **Céges sofőr:** Partner céghez tartozik, a cég számlázza
- **Magánszemély:** Saját számlára mos (`isPrivateCustomer: true`)

**Jóváhagyási folyamat:**
```
Regisztráció → PENDING → Admin jóváhagyás → APPROVED/REJECTED
```

---

### 2.6 Walk-in Customer (Alkalmi Vásárló)

**Leírás:** Regisztráció nélküli, helyszínen fizető ügyfél.

**Kezelés:** Operátor manuálisan rögzíti a mosást.

**Jellemzők:**
- Nincs felhasználói fiók
- Azonnali készpénzes/kártyás fizetés
- Opcionális számla (`walkInInvoiceRequested: true`)
- Fizetési módok: CASH, CARD, DKV, UTA, MOL

---

## 3. AUTHENTIKÁCIÓ ÉS BELÉPÉSI MÓDOK

### 3.1 Belépési Módok Összefoglaló

| Felhasználó | Belépési Mód | Session Típus |
|-------------|--------------|---------------|
| Platform Admin | Email + Jelszó | JWT Cookie |
| Network Admin | Email + Jelszó + Slug | JWT Cookie |
| Partner Admin | Email + Jelszó | Session (DB) |
| Operátor | Email + Jelszó | Session (DB) |
| Sofőr | Email + Jelszó | Session (DB) |

### 3.2 Jelszó Követelmények

- Minimum 8 karakter
- bcrypt hash (12 rounds)
- Alapértelmezett jelszó migrált felhasználóknak: `Demo1234!`

### 3.3 Biztonsági Mechanizmusok

**Fiókzárolás:**
- 5 sikertelen próbálkozás után
- 1 perces várakozási idő
- Minden próbálkozás logolva

**Token Kezelés:**
- JWT token httpOnly cookie-ban
- Refresh token támogatás
- CSRF védelem

**Jelszó Visszaállítás:**
- Email alapú token küldés
- Token lejárat: 1 óra
- Egyszeri felhasználás

---

## 4. ADATBÁZIS STRUKTÚRA ÉS KAPCSOLATOK

### 4.1 Fő Entitások Hierarchiája

```
Platform (gyökér)
└── Network (Hálózat)
    ├── NetworkAdmin (Hálózati admin)
    ├── NetworkSettings (Beállítások)
    ├── Location (Helyszín)
    │   ├── LocationOperator (Operátor)
    │   ├── LocationPartner (Alvállalkozó)
    │   └── BlockedTimeSlot (Zárolt időszakok)
    ├── PartnerCompany (Partner cég)
    │   ├── PartnerAdmin (Partner admin)
    │   ├── Driver (Sofőr)
    │   │   ├── Vehicle (Jármű)
    │   │   └── DriverInviteCode (Meghívó kód)
    │   └── PartnerCustomPrice (Egyedi árak)
    ├── ServicePackage (Szolgáltatáscsomag)
    │   └── ServicePrice (Ár járműtípusonként)
    ├── WashEvent (Mosás esemény)
    │   ├── WashEventService (Igénybe vett szolgáltatások)
    │   └── Invoice (Számla)
    ├── Booking (Foglalás)
    └── Invoice (Számlák)
```

### 4.2 Kulcs Kapcsolatok

**Network → Location (1:N)**
- Egy hálózathoz több helyszín tartozhat
- Helyszín csak egy hálózathoz tartozik

**Network → PartnerCompany (1:N)**
- Egy hálózathoz több partner cég tartozhat
- Partner cég csak egy hálózathoz tartozik

**PartnerCompany → Driver (1:N)**
- Egy partner céghez több sofőr tartozhat
- Sofőr csak egy partner céghez tartozik (adott időben)
- Partner nélküli sofőr = magánszemély

**Driver → Vehicle (1:N)**
- Egy sofőrnek több járműve lehet
- Jármű csak egy sofőrhez tartozik

**Location → WashEvent (1:N)**
- Mosás esemény egy helyszínhez kötődik
- Helyszínhez több mosás tartozhat

**WashEvent → WashEventService (1:N)**
- Egy mosáshoz több szolgáltatás tartozhat
- Szolgáltatás egy mosáshoz kötődik

**WashEvent → Invoice (1:1 opcionális)**
- Készpénzes mosáshoz számla generálható
- Szerződéses partnernél batch számlázás

### 4.3 Státusz Enumok

**WashEventStatus (Mosás státusz):**
```
CREATED        → Létrehozva (operátor rögzítette)
AUTHORIZED     → Engedélyezve (indulhat a mosás)
IN_PROGRESS    → Folyamatban (mosás zajlik)
COMPLETED      → Befejezve (mosás kész)
LOCKED         → Zárolva (számlázásra kész)
REJECTED       → Elutasítva (okkal együtt)
```

**DriverApprovalStatus (Sofőr jóváhagyás):**
```
PENDING   → Jóváhagyásra vár
APPROVED  → Jóváhagyva
REJECTED  → Elutasítva
```

**BookingStatus (Foglalás státusz):**
```
PENDING       → Függőben
CONFIRMED     → Megerősítve
IN_PROGRESS   → Folyamatban
COMPLETED     → Teljesítve
NO_SHOW       → Nem jelent meg
CANCELLED     → Lemondva
```

**BillingType (Számlázási típus):**
```
CONTRACT  → Szerződéses (havi gyűjtőszámla)
CASH      → Készpénzes (azonnali fizetés)
```

**SubscriptionStatus (Előfizetés státusz):**
```
TRIAL      → Próbaidőszak (14 nap)
ACTIVE     → Aktív előfizetés
SUSPENDED  → Felfüggesztve (fizetési hiba)
CANCELLED  → Lemondva
```

---

## 5. MOSÁS REGISZTRÁLÁSI FOLYAMATOK

### 5.1 QR Kódos Mosás (Sofőr indítja)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Sofőr beolvassa a helyszín QR kódját                    │
│    └── PWA: /wash/scan                                      │
├─────────────────────────────────────────────────────────────┤
│ 2. Rendszer azonosítja a sofőrt és helyszínt               │
│    └── WashEvent létrejön (status: CREATED, mode: QR_DRIVER)│
├─────────────────────────────────────────────────────────────┤
│ 3. Sofőr kiválasztja a járművet és szolgáltatásokat        │
│    └── Automatikus ár kalkuláció                            │
├─────────────────────────────────────────────────────────────┤
│ 4. Operátor engedélyezi a mosást                           │
│    └── status: CREATED → AUTHORIZED                         │
├─────────────────────────────────────────────────────────────┤
│ 5. Operátor elindítja a mosást                             │
│    └── status: AUTHORIZED → IN_PROGRESS                     │
├─────────────────────────────────────────────────────────────┤
│ 6. Operátor befejezi a mosást                              │
│    └── status: IN_PROGRESS → COMPLETED                      │
├─────────────────────────────────────────────────────────────┤
│ 7. Számlázás (ha szükséges)                                │
│    └── CONTRACT: havi gyűjtő / CASH: azonnali számla        │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Manuális Mosás (Operátor indítja)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Operátor megnyitja az új mosás formot                   │
│    └── /operator-portal/wash/new                            │
├─────────────────────────────────────────────────────────────┤
│ 2. Operátor beírja a rendszámot                            │
│    └── Automatikus partner keresés előző mosások alapján    │
├─────────────────────────────────────────────────────────────┤
│ 3. Operátor kiválasztja/létrehozza a partnert              │
│    ├── Létező partner → kiválasztás listából               │
│    └── Új ügyfél → ad-hoc partner létrehozás               │
├─────────────────────────────────────────────────────────────┤
│ 4. Operátor kiválasztja a szolgáltatásokat                 │
│    └── Több szolgáltatás is választható                     │
├─────────────────────────────────────────────────────────────┤
│ 5. Fizetési mód kiválasztása                               │
│    └── CASH, CARD, DKV, UTA, MOL                           │
├─────────────────────────────────────────────────────────────┤
│ 6. WashEvent létrejön és azonnal COMPLETED státuszba kerül │
│    └── mode: MANUAL_OPERATOR                                │
├─────────────────────────────────────────────────────────────┤
│ 7. Számla generálás (ha kérték)                            │
│    └── walkInInvoiceRequested: true esetén                  │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Foglalás Alapú Mosás

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Sofőr foglalást hoz létre                               │
│    └── /booking oldal, időpont és szolgáltatás választás    │
├─────────────────────────────────────────────────────────────┤
│ 2. Foglalás státusza: PENDING                              │
│    └── Email értesítés a sofőrnek                          │
├─────────────────────────────────────────────────────────────┤
│ 3. Sofőr megérkezik a helyszínre                           │
│    └── QR kód beolvasás vagy operátor azonosítás           │
├─────────────────────────────────────────────────────────────┤
│ 4. Operátor megerősíti a foglalást                         │
│    └── Foglalás: PENDING → CONFIRMED                        │
│    └── WashEvent létrejön és kapcsolódik a foglaláshoz      │
├─────────────────────────────────────────────────────────────┤
│ 5. Mosás folyamata (lásd fent)                             │
├─────────────────────────────────────────────────────────────┤
│ 6. Befejezés                                               │
│    └── Foglalás: CONFIRMED → COMPLETED                      │
│    └── WashEvent: IN_PROGRESS → COMPLETED                   │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Státusz Átmenetek (State Machine)

```
                    ┌──────────┐
                    │ CREATED  │
                    └────┬─────┘
                         │ Operátor engedélyez
                         ▼
                    ┌──────────┐
                    │AUTHORIZED│
                    └────┬─────┘
                         │ Operátor indít
                         ▼
                   ┌───────────┐
                   │IN_PROGRESS│
                   └─────┬─────┘
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
      ┌──────────┐              ┌──────────┐
      │COMPLETED │              │ REJECTED │
      └────┬─────┘              └──────────┘
           │ Számlázás után
           ▼
      ┌──────────┐
      │  LOCKED  │
      └──────────┘
```

---

## 6. FOGLALÁSI RENDSZER

### 6.1 Foglalás Létrehozása

**Ki hozhat létre foglalást:**
- Sofőr (PWA-n keresztül)
- Operátor (walk-in ügyfélnek)
- Partner Admin (sofőr nevében)

**Szükséges adatok:**
- Helyszín kiválasztása
- Időpont (dátum + időablak)
- Járműtípus
- Szolgáltatás(ok)
- Kontakt adatok (walk-in esetén)

### 6.2 Időablak Kezelés

**Konfiguráció (NetworkSettings):**
```typescript
bookingTimeSlotDurationMinutes: number  // Alapértelmezett: 30 perc
bookingMaxConcurrentSlots: number       // Max párhuzamos foglalás
bookingAdvanceDaysLimit: number         // Előre foglalható napok
bookingCancellationMinutesNotice: number // Lemondási határidő
```

**Elérhető időpontok kalkulációja:**
1. Nyitvatartási idő alapján
2. Mínusz blokkolt időszakok
3. Mínusz már foglalt időpontok
4. Max párhuzamos foglalások figyelembevétele

### 6.3 Blokkolt Időszakok

**Típusok:**
- **Egyedi blokkolás:** Konkrét dátum és időszak
- **Ismétlődő blokkolás:** Pl. minden hétfő 10:00-11:00

**Használati esetek:**
- Karbantartás
- Szünet
- Foglalt kapacitás
- Ünnepnapok

### 6.4 Foglalás Státuszok

| Státusz | Leírás | Következő |
|---------|--------|-----------|
| PENDING | Foglalás létrehozva | CONFIRMED, CANCELLED |
| CONFIRMED | Operátor megerősítette | IN_PROGRESS, NO_SHOW, CANCELLED |
| IN_PROGRESS | Mosás zajlik | COMPLETED |
| COMPLETED | Sikeres teljesítés | - |
| NO_SHOW | Ügyfél nem jelent meg | - |
| CANCELLED | Lemondva | - |

---

## 7. SZÁMLÁZÁSI RENDSZER

### 7.1 Számlázási Típusok

**CONTRACT (Szerződéses):**
- Havi gyűjtőszámla
- Partner cég fizet
- Elszámolási időszak: hónap vége
- Automatikus számla generálás

**CASH (Készpénzes):**
- Azonnali fizetés helyszínen
- Walk-in ügyfelek
- Számla opcionális

### 7.2 Számla Típusok

| Típus | Leírás | Címzett |
|-------|--------|---------|
| Partner Invoice | Partner cég havi gyűjtőszámlája | Partner cég |
| Cash Invoice | Készpénzes mosás számlája | Walk-in ügyfél |
| Driver Invoice | Magánszemély sofőr számlája | Sofőr |
| Location Invoice | Alvállalkozói elszámolás | Helyszín partner |
| Platform Invoice | Platform használati díj | Hálózat admin |

### 7.3 Számla Státuszok

```
DRAFT → ISSUED → SENT → PAID | OVERDUE | CANCELLED
```

### 7.4 Integrációk

**szamlazz.hu:**
- Automatikus számla generálás
- PDF letöltés
- NAV online számla beküldés

---

## 8. EMAIL ÉS ÉRTESÍTÉSI RENDSZER

### 8.1 Email Típusok

| Típus | Címzett | Trigger |
|-------|---------|---------|
| Email Megerősítés | Sofőr | Regisztrációkor |
| Regisztráció Értesítés | Admin/Partner | Új sofőr regisztrál |
| Jóváhagyás Értesítés | Sofőr | Admin jóváhagyja |
| Elutasítás Értesítés | Sofőr | Admin elutasítja |
| Jelszó Visszaállítás | Bárki | Visszaállítás kérés |
| Foglalás Visszaigazolás | Ügyfél | Foglalás létrehozása |
| Foglalás Emlékeztető | Ügyfél | 24 órával előtte |
| Partner Váltás | Admin/Partner | Sofőr céget vált |
| Fizetési Hiba | Network Admin | Stripe hiba |
| Trial Lejárat | Network Admin | 3 nappal előtte |
| Trial Lejárt | Network Admin | Trial vége |
| Törlés Kérelem | Admin | Operátor törlést kér |
| Számla Kiállítva | Partner/Sofőr | Számla generálás |
| Teszt Email | Bárki | Admin küld tesztet |

### 8.2 Email Szolgáltatók

**Platform SMTP:**
- Host: smtp.websupport.hu
- Fallback minden hálózatnak

**Resend API:**
- Modern email API
- Hálózatonként konfigurálható

**Egyedi SMTP:**
- Hálózat saját SMTP szervere
- Teljes testreszabhatóság

### 8.3 Konfiguráció

```typescript
// NetworkSettings
emailProvider: 'PLATFORM' | 'RESEND' | 'SMTP'
resendApiKey: string
smtpHost: string
smtpPort: number
smtpUser: string
smtpPassword: string
smtpFromEmail: string
smtpFromName: string
```

---

## 9. KÜLSŐ SZOLGÁLTATÓK INTEGRÁCIÓJA

### 9.1 Email Szolgáltatók

| Szolgáltató | Státusz | Használat |
|-------------|---------|-----------|
| SMTP (websupport.hu) | ✅ Aktív | Platform alapértelmezett |
| Resend API | ✅ Aktív | Hálózati opció |
| Egyedi SMTP | ✅ Aktív | Hálózati opció |

### 9.2 Számlázás

| Szolgáltató | Státusz | Használat |
|-------------|---------|-----------|
| szamlazz.hu | 🔧 Előkészítve | Magyar számlázás |
| Billingo | 🔧 Előkészítve | Alternatív számlázás |

### 9.3 Fizetés

| Szolgáltató | Státusz | Használat |
|-------------|---------|-----------|
| Stripe | 🔧 Előkészítve | Előfizetés kezelés |
| Helyi fizetés | ✅ Aktív | CASH, CARD, DKV, UTA, MOL |

### 9.4 SMS

| Szolgáltató | Státusz | Használat |
|-------------|---------|-----------|
| Twilio | 🔧 Előkészítve | SMS értesítések |

### 9.5 Cégadatok

| Szolgáltató | Státusz | Használat |
|-------------|---------|-----------|
| NAV/TA | 🔧 Opcionális | Magyar cégjegyzék |

---

## 10. BEÁLLÍTÁSI LEHETŐSÉGEK

### 10.1 Hálózati Beállítások (NetworkSettings)

**Email Konfiguráció:**
```typescript
emailProvider: 'PLATFORM' | 'RESEND' | 'SMTP'
resendApiKey: string
smtpHost: string
smtpPort: number
smtpUser: string
smtpPassword: string
smtpFromEmail: string
smtpFromName: string
```

**Foglalási Rendszer:**
```typescript
bookingEnabled: boolean
bookingAdvanceDaysLimit: number      // Előre foglalható napok
bookingCancellationMinutesNotice: number
bookingTimeSlotDurationMinutes: number  // Időablak hossza
bookingMaxConcurrentSlots: number    // Max párhuzamos foglalás
```

**Mosás Konfiguráció:**
```typescript
washMode: 'SELF_SERVICE' | 'MANUAL_OPERATOR' | 'QR_CODE'
autoCompleteWashMinutes: number      // Auto befejezés
requireLocationPartnerApproval: boolean
```

**Előfizetés:**
```typescript
subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
trialEndsAt: DateTime
billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
stripeCustomerId: string
stripeSubscriptionId: string
```

**SMS:**
```typescript
smsEnabled: boolean
twilioAccountSid: string
twilioAuthToken: string
```

**Egyéb:**
```typescript
useLocationPartners: boolean         // Alvállalkozó támogatás
companyDataProvider: 'HU_NAVT' | 'NONE'
```

### 10.2 Helyszín Beállítások (Location)

```typescript
name: string
code: string                         // Egyedi kód
address: string
city: string
zipCode: string
country: string
phone: string
email: string
locationType: 'TRUCK_WASH' | 'CAR_WASH' | 'SERVICE_CENTER'
washMode: 'SELF_SERVICE' | 'MANUAL_OPERATOR'
isActive: boolean
openingHoursStructured: [
  { dayOfWeek: number, openTime: string, closeTime: string, isClosed: boolean }
]
```

### 10.3 Szolgáltatás Árazás

**ServicePackage:**
```typescript
name: string
description: string
isActive: boolean
displayOrder: number
```

**ServicePrice (járműtípusonként):**
```typescript
vehicleType: 'CAR' | 'VAN' | 'BUS' | 'SEMI_TRUCK' | 'TRUCK_12T' | 'TRAILER'
basePrice: number
discountedPrice: number (opcionális)
```

**PartnerCustomPrice (egyedi partner árak):**
```typescript
partnerId: string
servicePackageId: string
customPrice: number
```

---

## 11. BIZTONSÁGI FUNKCIÓK

### 11.1 Jelszó Kezelés

- **Algoritmus:** bcrypt
- **Rounds:** 12
- **Minimum hossz:** 8 karakter

### 11.2 Fiókzárolás

- 5 sikertelen bejelentkezés után
- 1 perc várakozási idő
- IP alapú követés

### 11.3 Session Kezelés

**JWT Token:**
- httpOnly cookie
- Lejárati idő konfigurálható
- Refresh token támogatás

**Database Session:**
- Operátor és sofőr esetén
- Session ID localStorage-ban
- Szerver oldali validáció

### 11.4 CSRF Védelem

- Refresh token mechanizmus
- Double submit cookie

### 11.5 Rate Limiting

- `@LoginThrottle` decorator
- Végpontonként konfigurálható
- IP alapú

### 11.6 Audit Logging

**Logolt műveletek:**
- Sikeres/sikertelen bejelentkezések
- Adatmódosítások (előtte/utána)
- Jogosultság változások
- Érzékeny műveletek

**Rögzített adatok:**
- Actor típus és ID
- IP cím
- User agent
- Timestamp
- Előző és új adatok

### 11.7 Titkosítás

- Érzékeny adatok titkosított tárolása
- API kulcsok környezeti változókban
- HTTPS minden kommunikációra

---

## 12. API VÉGPONTOK

### 12.1 Platform Admin (`/platform-admin`)

```
POST   /login                    # Bejelentkezés
POST   /register                 # Regisztráció
GET    /dashboard               # Dashboard adatok
GET    /networks                # Hálózatok listázása
POST   /networks                # Új hálózat
GET    /networks/:id            # Hálózat részletei
PUT    /networks/:id            # Hálózat módosítás
DELETE /networks/:id            # Hálózat törlés
GET    /admins                  # Platform adminok
POST   /admins                  # Új admin
GET    /audit-logs              # Audit logok
GET    /billing/invoices        # Platform számlák
```

### 12.2 Network Admin (`/network-admin`)

```
POST   /login                    # Bejelentkezés
POST   /register                 # Regisztráció
GET    /dashboard               # Dashboard
GET    /locations               # Helyszínek
POST   /locations               # Új helyszín
GET    /locations/:id           # Helyszín részletei
PUT    /locations/:id           # Helyszín módosítás
GET    /partners                # Partner cégek
POST   /partners                # Új partner
GET    /partners/:id            # Partner részletei
GET    /drivers                 # Sofőrök
POST   /drivers/:id/approve     # Sofőr jóváhagyás
POST   /drivers/:id/reject      # Sofőr elutasítás
GET    /wash-events             # Mosások
GET    /settings                # Beállítások
PUT    /settings                # Beállítások módosítás
POST   /settings/test-email     # Teszt email
GET    /invoices                # Számlák
GET    /statistics              # Statisztikák
POST   /subscription/upgrade    # Előfizetés váltás
```

### 12.3 Operator Portal (`/operator-portal`)

```
POST   /login                           # Bejelentkezés
POST   /request-password-reset          # Jelszó visszaállítás kérés
POST   /reset-password                  # Jelszó visszaállítás
GET    /profile                         # Profil
GET    /queue                           # Mosási sor
GET    /wash-events                     # Mosások
POST   /wash-events                     # Új mosás (manuális)
POST   /wash-events/:id/authorize       # Mosás engedélyezés
POST   /wash-events/:id/start           # Mosás indítás
POST   /wash-events/:id/complete        # Mosás befejezés
POST   /wash-events/:id/reject          # Mosás elutasítás
POST   /wash-events/:id/request-delete  # Törlés kérelem
GET    /lookup-plate/:plate             # Rendszám keresés
GET    /bookings/today                  # Mai foglalások
POST   /bookings/:id/confirm            # Foglalás megerősítés
GET    /blocked-slots                   # Blokkolt időszakok
POST   /blocked-slots                   # Új blokkolás
DELETE /blocked-slots/:id               # Blokkolás törlés
GET    /statistics                      # Statisztikák
```

### 12.4 Partner Portal (`/partner-portal`)

```
POST   /login                           # Bejelentkezés
POST   /request-password-reset          # Jelszó visszaállítás kérés
POST   /reset-password                  # Jelszó visszaállítás
GET    /profile                         # Profil
GET    /drivers                         # Sofőrök
GET    /wash-events                     # Mosások
GET    /statistics                      # Statisztikák
GET    /invoices                        # Számlák
GET    /invoices/summary                # Számla összesítő
GET    /pin-reset-requests              # PIN visszaállítás kérelmek
POST   /pin-reset-requests/:id/complete # Kérelem teljesítés
POST   /pin-reset-requests/:id/reject   # Kérelem elutasítás
```

### 12.5 Driver PWA (`/pwa`)

```
POST   /register                        # Regisztráció
POST   /login                           # Bejelentkezés (email+jelszó)
POST   /login-phone                     # Bejelentkezés (telefon+PIN) [DEPRECATED]
POST   /login-email                     # Bejelentkezés (email+PIN) [DEPRECATED]
GET    /profile                         # Profil
PUT    /profile                         # Profil módosítás
GET    /vehicles                        # Járművek
POST   /vehicles                        # Új jármű
DELETE /vehicles/:id                    # Jármű törlés
POST   /booking                         # Új foglalás
GET    /bookings/upcoming               # Közelgő foglalások
DELETE /bookings/:id                    # Foglalás lemondás
POST   /wash/scan-qr                    # QR beolvasás
GET    /wash/history                    # Mosási előzmények
POST   /request-password-reset          # Jelszó visszaállítás kérés
POST   /reset-password                  # Jelszó visszaállítás
POST   /request-pin-reset               # PIN visszaállítás kérés [DEPRECATED]
GET    /invoices                        # Számlák (magánszemély)
```

---

## 13. FRONTEND STRUKTÚRA

### 13.1 Főbb Útvonalak

```
/                              # Főoldal / Belépés választó
/login                         # Sofőr bejelentkezés
/register                      # Sofőr regisztráció
/register-qr/[network]         # QR alapú regisztráció
/dashboard                     # Sofőr dashboard
/wash/new                      # Új mosás
/wash/scan                     # QR scanner
/wash/history                  # Mosási előzmények
/booking                       # Foglalás
/vehicles                      # Járművek kezelése
/profile                       # Profil
/forgot-password               # Jelszó visszaállítás

/operator-portal/login         # Operátor belépés
/operator-portal/dashboard     # Operátor dashboard
/operator-portal/wash/*        # Mosás kezelés
/operator-portal/bookings      # Foglalások

/partner/login                 # Partner belépés
/partner/dashboard             # Partner dashboard
/partner/drivers               # Sofőrök
/partner/invoices              # Számlák

/network-admin/login           # Admin belépés
/network-admin/dashboard       # Admin dashboard
/network-admin/locations       # Helyszínek
/network-admin/partners        # Partnerek
/network-admin/drivers         # Sofőrök
/network-admin/settings        # Beállítások

/platform-admin/login          # Platform admin belépés
/platform-admin/dashboard      # Platform dashboard
/platform-admin/networks       # Hálózatok
```

### 13.2 Komponens Könyvtár

```
pwa/src/
├── app/                       # Next.js App Router oldalak
├── components/
│   ├── ui/                    # Alap UI komponensek
│   ├── forms/                 # Form komponensek
│   ├── tables/                # Táblázatok
│   └── layouts/               # Layout komponensek
├── lib/
│   ├── api.ts                 # API hívások
│   ├── session.ts             # Session kezelés
│   └── utils.ts               # Utility függvények
└── styles/                    # Globális stílusok
```

---

## FÜGGELÉK

### A. Járműtípusok

| Kód | Magyar | Leírás |
|-----|--------|--------|
| CAR | Személyautó | Kisautók |
| VAN | Kisteherautó | Furgonok |
| BUS | Busz | Személyszállító buszok |
| SEMI_TRUCK | Kamion | Nyerges vontatók |
| TRUCK_12T | Kamion 12t+ | Nagy teherbírású |
| TRAILER | Pótkocsi | Utánfutók |

### B. Fizetési Módok

| Kód | Leírás |
|-----|--------|
| CASH | Készpénz |
| CARD | Bankkártya |
| DKV | DKV üzemanyagkártya |
| UTA | UTA üzemanyagkártya |
| MOL | MOL üzemanyagkártya |

### C. Alapértelmezett Belépési Adatok

**Minden migrált felhasználó alapértelmezett jelszava:**
```
Demo1234!
```

**Platform Admin:**
- Email: admin@vemiax.com

**Network Admin:**
- Email: gabhol@gmail.com
- Slug: vsys-demo

**Partner Portal példa:**
- Email: info@eurocargo.hu

**Operator Portal példa:**
- Email: gyor2.operator@demo.vemiax.com

**Driver/PWA példa:**
- Email: kovacs.istvan@example.com

---

**Dokumentáció készült:** 2026-01-22
**Verzió:** 1.0
**Backup tag:** backup-2026-01-22-unified-auth-complete
