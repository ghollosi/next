# vSys Wash Platform - Rendszer Áttekintés

## Mi a vSys?

A **vSys Wash** egy modern, felhő alapú szoftverplatform kamion- és autómosó hálózatok teljes körű kezelésére. A rendszer lehetővé teszi a mosási műveletek digitális nyilvántartását, az ügyfelek és sofőrök kezelését, az időpontfoglalást, valamint az automatizált számlázást.

---

## A rendszer felépítése

A vSys egy **többszintű, multi-tenant SaaS platform**, amely hierarchikus jogosultsági rendszert alkalmaz:

```
┌─────────────────────────────────────────────────────────┐
│                    PLATFORM SZINT                        │
│              (Platform Owner / Admin)                    │
│         Teljes platform felügyelet, hálózatok           │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Hálózat A  │  │  Hálózat B  │  │  Hálózat C  │
│ (Network)   │  │ (Network)   │  │ (Network)   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
   ┌───┴───┐        ┌───┴───┐        ┌───┴───┐
   ▼       ▼        ▼       ▼        ▼       ▼
┌─────┐ ┌─────┐  ┌─────┐ ┌─────┐  ┌─────┐ ┌─────┐
│Hely-│ │Hely-│  │Hely-│ │Hely-│  │Hely-│ │Hely-│
│szín │ │szín │  │szín │ │szín │  │szín │ │szín │
└─────┘ └─────┘  └─────┘ └─────┘  └─────┘ └─────┘
```

---

## Felhasználói szerepkörök

### Platform szint

| Szerepkör | Leírás | Fő feladatok |
|-----------|--------|--------------|
| **Platform Owner** | Platform tulajdonos | Teljes hozzáférés, hálózatok létrehozása, rendszerbeállítások |
| **Platform Admin** | Platform adminisztrátor | Hálózatok felügyelete, támogatás |

### Hálózat szint

| Szerepkör | Leírás | Fő feladatok |
|-----------|--------|--------------|
| **Network Owner** | Hálózat tulajdonos | Teljes hálózat kezelés |
| **Network Admin** | Hálózat admin | Helyszínek, sofőrök, partnerek kezelése |
| **Network Controller** | Pénzügyi vezető | Riportok, pénzügyi áttekintés |
| **Network Accountant** | Könyvelő | Számlázás, export |

### Operatív szint

| Szerepkör | Leírás | Fő feladatok |
|-----------|--------|--------------|
| **Location Operator** | Mosó operátor | Mosások rögzítése, napi műveletek |
| **Driver** | Sofőr (flotta/privát) | Mosás indítása, foglalás |
| **Partner Admin** | Partner cég admin | Sofőrök kezelése, számlák megtekintése |

---

## Főbb portálok és felületek

### 1. Platform Admin Panel
**URL:** `app.vemiax.com/platform-admin`

A platform tulajdonosok és adminisztrátorok kezelőfelülete.

**Főbb funkciók:**
- Hálózatok létrehozása és kezelése
- Platform szintű beállítások
- Számlázás és előfizetések kezelése
- Audit napló megtekintése

![Platform Admin Dashboard](images/platform-admin-dashboard.png)

---

### 2. Network Admin Panel
**URL:** `app.vemiax.com/network-admin`

A hálózat adminisztrátorok fő kezelőfelülete.

**Főbb funkciók:**
- **Dashboard** - Napi áttekintés, statisztikák
- **Helyszínek** - Mosóállomások kezelése
- **Sofőrök** - Sofőr regisztrációk jóváhagyása
- **Partner cégek** - Flotta partnerek kezelése
- **Mosások** - Mosási események áttekintése
- **Számlák** - Számlázás és pénzügyek
- **Riportok** - Statisztikák, kimutatások
- **Árlista** - Szolgáltatások és árak

![Network Admin Dashboard](images/network-admin-dashboard.png)

![Network Admin Helyszínek](images/network-admin-locations.png)

---

### 3. Operátor Portál
**URL:** `app.vemiax.com/operator-portal`

A helyszíni operátorok (mosó dolgozók) kezelőfelülete.

**Főbb funkciók:**
- Mosások manuális rögzítése
- Napi foglalások megtekintése
- Dashboard és statisztikák
- Számlázási funkciók (alvállalkozók)

![Operátor Portál](images/operator-portal-login.png)

---

### 4. Sofőr Alkalmazás (PWA)
**URL:** `app.vemiax.com`

Mobilra optimalizált webalkalmazás a sofőrök számára.

**Főbb funkciók:**
- QR kódos mosás indítás
- Időpont foglalás
- Járművek kezelése
- Mosási előzmények

![Sofőr App](images/driver-login.png)

---

### 5. Partner Portál
**URL:** `app.vemiax.com/partner`

Flotta partner cégek adminisztrációs felülete.

**Főbb funkciók:**
- Sofőrök kezelése és jóváhagyása
- Mosási statisztikák
- Számlák megtekintése

![Partner Portál](images/partner-portal-login.png)

---

## Fő funkcionális területek

### 1. Mosás kezelés
- **QR kódos mód**: Sofőr olvassa be a helyszín QR kódját
- **Manuális mód**: Operátor rögzíti a mosást
- Automatikus státusz követés (Létrehozva → Folyamatban → Befejezve)

### 2. Foglalási rendszer
- Online időpont foglalás
- Helyszín kapacitás kezelés
- Automatikus emlékeztetők

### 3. Számlázás
- Partner cégeknek: Gyűjtőszámla (heti/havi)
- Privát ügyfeleknek: Egyedi számlák
- Alvállalkozóknak: Helyszín kimutatások
- Integráció: szamlazz.hu, Billingo

### 4. Sofőr regisztráció
- QR kódos regisztráció
- Email/SMS megerősítés
- Jóváhagyási folyamat

---

## Helyszín típusok

| Típus | Leírás |
|-------|--------|
| **Kamionmosó** | Vontató + pótkocsi kezelés |
| **Autómosó** | Egy rendszám kezelés |

## Helyszín láthatóság

| Mód | Ki látja |
|-----|----------|
| **Publikus** | Mindenki (privát ügyfelek is) |
| **Csak hálózat** | A hálózat sofőrei |
| **Dedikált** | Csak kiválasztott partnerek |

---

## Integrációk

- **Fizetés**: Stripe, SimplePay, Barion
- **Számlázás**: szamlazz.hu, Billingo, NAV Online
- **Értesítések**: Email (SMTP/Resend), SMS (Twilio/Vonage)
- **Cégadatok**: Opten, Bisnode, e-Cégjegyzék

---

## Előnyök

| Előny | Leírás |
|-------|--------|
| **Digitalizáció** | Papírmentes mosás nyilvántartás |
| **Átláthatóság** | Valós idejű statisztikák és riportok |
| **Automatizáció** | Automatikus számlázás, értesítések |
| **Rugalmasság** | Többféle mosó típus és üzemmód |
| **Skálázhatóság** | Korlátlan hálózat és helyszín |

---

## Gyors kezdés

1. **Regisztráció**: `app.vemiax.com/network-admin/register`
2. **14 napos ingyenes próbaidőszak**
3. **Helyszínek hozzáadása**
4. **Sofőrök meghívása QR kóddal**
5. **Mosások indítása**

---

*Dokumentum verzió: 1.0*
*Utolsó frissítés: 2026. január 19.*
