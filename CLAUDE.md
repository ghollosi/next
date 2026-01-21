# VSys Wash - Teljes Projekt Dokumentáció

> **FONTOS:** Ez a fájl minden új Claude Code beszélgetés elején automatikusan beolvasásra kerül.
> Tartalmazza az összes szükséges információt a fejlesztés folytatásához.

---

## 1. PROJEKT ÁTTEKINTÉS

### Mi ez a projekt?
**VSys Wash** - Többhálózatos autómosó menedzsment rendszer (multi-tenant SaaS).

### Fő funkciók:
- Hálózatok (Networks) kezelése - minden hálózat független
- Partner cégek és sofőrök menedzselése
- Mosóhelyszínek (Locations) kezelése
- Foglalások és mosások nyilvántartása
- Operátor portál mosásokhoz
- Email és SMS értesítések
- Stripe előfizetés kezelés (trial + fizetős)

### Tech Stack:
- **Backend:** NestJS + Prisma + PostgreSQL
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Infrastruktúra:** Docker + Hetzner VPS + Caddy (reverse proxy)
- **Email:** Resend API + SMTP (smtp.websupport.hu)
- **Fizetés:** Stripe (előkészítve)

---

## 2. DEPLOYMENT - KRITIKUS INFORMÁCIÓK

### Szerver adatok:
```
IP: 46.224.157.177
SSH Key: ~/.ssh/vsys-hetzner
User: root
Directory: /root/vsys-next (NEM /opt/vsys!)
```

### URLs:
```
PWA (Frontend): https://app.vemiax.com
API (Backend):  https://api.vemiax.com
```

### Docker containers:
```
vsys-api      - NestJS backend (port 3000)
vsys-pwa      - Next.js frontend (port 3001)
vsys-postgres - PostgreSQL 16 database
```

### Deploy parancsok:

#### 1. Fájlok szinkronizálása:
```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' \
  -e "ssh -i ~/.ssh/vsys-hetzner" \
  /Users/hollosigabor/Downloads/NewvSys/ \
  root@46.224.157.177:/root/vsys-next/
```

#### 2. Újraépítés és indítás:
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

#### 3. Státusz ellenőrzés:
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml ps"
```

#### 4. Logok megtekintése:
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-pwa --tail 100"
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-api --tail 100"
```

#### 5. Gyors újraindítás (rebuild nélkül):
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml restart pwa"
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml restart api"
```

### ⚠️ SOHA NE HASZNÁLD EZEKET:
```
docker compose down -v        # -v TÖRLI AZ ADATBÁZIST!
/opt/vsys/                    # Régi könyvtár, NE HASZNÁLD!
docker-compose.yml            # Rossz fájl! Használd: docker-compose.full.yml
```

---

## 3. ADATBÁZIS

### Kapcsolódási adatok:
```
Host: vsys-postgres (docker network-ön belül)
Database: vsys_next
User: vsys
Password: vsys_staging_password
```

### Prisma parancsok (szerveren):
```bash
# Migráció futtatása
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec vsys-api npx prisma migrate deploy"

# Prisma Studio (lokálisan)
cd /Users/hollosigabor/Downloads/NewvSys && npx prisma studio
```

### Backup készítése:
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec vsys-postgres pg_dump -U vsys vsys_next" > backup.sql
```

### Backup visszaállítása:
```bash
# 1. Másold fel a backup fájlt
scp -i ~/.ssh/vsys-hetzner backup.sql root@46.224.157.177:/tmp/

# 2. Állítsd vissza (VIGYÁZAT - felülírja az adatokat!)
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec -i vsys-postgres psql -U vsys vsys_next < /tmp/backup.sql"
```

---

## 4. KÖRNYEZETI VÁLTOZÓK

### Szerveren (.env fájl):
```bash
# Lokáció: /root/vsys-next/.env

# Database
POSTGRES_USER=vsys
POSTGRES_PASSWORD=vsys_staging_password
POSTGRES_DB=vsys_next

# JWT
JWT_SECRET=K8xPmN2vQ9wR4tY7uI0oL3jH6gF5dS8aZ1xC4vB7nM2kJ9pQ6wE3rT0yU5iO8lA1

# Email SMTP
SMTP_HOST=smtp.websupport.hu
SMTP_PORT=587
SMTP_USER=info@vemiax.com
SMTP_PASS=Vemiax2026!

# URLs
CORS_ORIGIN=https://app.vemiax.com,https://vsys.vemiax.com,https://api.vemiax.com
NEXT_PUBLIC_API_URL=https://api.vemiax.com
FRONTEND_URL=https://app.vemiax.com
```

---

## 5. PROJEKT STRUKTÚRA

```
/Users/hollosigabor/Downloads/NewvSys/
├── src/                          # NestJS Backend
│   ├── modules/
│   │   ├── booking/              # Foglalások
│   │   ├── driver/               # Sofőrök
│   │   ├── email/                # Email küldés
│   │   ├── notification/         # Értesítések
│   │   └── sms/                  # SMS küldés
│   ├── network-admin/            # Network Admin API
│   ├── operator-portal/          # Operátor API
│   ├── partner-portal/           # Partner API
│   ├── platform-admin/           # Platform Admin API
│   └── pwa/                      # PWA (Driver) API
│
├── pwa/                          # Next.js Frontend
│   └── src/
│       ├── app/
│       │   ├── network-admin/    # Network Admin UI
│       │   ├── operator-portal/  # Operátor UI
│       │   ├── partner-portal/   # Partner UI
│       │   ├── platform-admin/   # Platform Admin UI
│       │   └── (driver pages)    # Sofőr UI
│       ├── components/           # Közös komponensek
│       └── lib/                  # API hívások, utils
│
├── prisma/
│   └── schema.prisma             # Adatbázis séma
│
├── docker-compose.full.yml       # Production docker config
├── Dockerfile.api                # API container
├── Dockerfile.pwa                # PWA container
└── backup/                       # Backup fájlok
```

---

## 6. FŐBB ENTITÁSOK (Prisma Schema)

```
Network          - Hálózat (multi-tenant root)
NetworkAdmin     - Hálózat adminisztrátor
Location         - Mosóhelyszín
Partner          - Partner cég
PartnerAdmin     - Partner adminisztrátor
Driver           - Sofőr
Operator         - Operátor (mosóhelyszínen)
Booking          - Foglalás
CompletedWash    - Elvégzett mosás
VerificationToken - Email/jelszó visszaállító tokenek
```

---

## 7. AUTHENTIKÁCIÓ

### Típusok:
1. **Platform Admin** - Email + jelszó (bcrypt)
2. **Network Admin** - Email + jelszó (bcrypt)
3. **Partner Admin** - Telefon + PIN
4. **Operator** - Telefon + PIN
5. **Driver (Sofőr)** - Telefon + PIN vagy Invite kód

### JWT token struktúra:
```typescript
{
  sub: string,      // User ID
  role: string,     // 'PLATFORM_ADMIN' | 'NETWORK_ADMIN' | 'PARTNER_ADMIN' | 'OPERATOR' | 'DRIVER'
  networkId?: string,
  partnerId?: string,
  locationId?: string
}
```

---

## 8. EMAIL RENDSZER

### Email típusok (mind működik):
1. **Foglalás visszaigazolás** - Ügyfélnek
2. **Email megerősítés** - Sofőrnek regisztrációkor
3. **Regisztráció jóváhagyva** - Sofőrnek
4. **Új regisztráció értesítés** - Admin/Partnernek
5. **PIN visszaállítás** - Partner/Operátornak
6. **Jelszó visszaállítás** - Network/Platform Adminnak
7. **Sikertelen fizetés** - Network Adminnak
8. **Trial lejárat** - Network Adminnak
9. **Törlési kérelem** - Network Adminnak
10. **Üdvözlő email** - Új Network Adminnak

### Email küldés tesztelése:
```bash
# Network Admin beállításokban van "Teszt email küldése" gomb
# vagy közvetlenül API-n keresztül
```

---

## 9. API VÉGPONTOK (főbbek)

```
# Platform Admin
POST   /platform-admin/login
GET    /platform-admin/networks
POST   /platform-admin/networks

# Network Admin
POST   /network-admin/login
POST   /network-admin/register
GET    /network-admin/dashboard
GET    /network-admin/locations
GET    /network-admin/partners
GET    /network-admin/drivers

# Partner Portal
POST   /partner-portal/login
GET    /partner-portal/drivers

# Operator Portal
POST   /operator-portal/login
GET    /operator-portal/dashboard
POST   /operator-portal/wash

# PWA (Driver)
POST   /pwa/login
POST   /pwa/register
GET    /pwa/profile
POST   /pwa/booking
```

---

## 10. VISSZAÁLLÍTÁSI PONTOK

### Legutóbbi backup:
```
Tag: backup-2026-01-21-full
Commit: 2014cb5
Dátum: 2026-01-21 19:43 CET
Fájl: backup/2026-01-21-full-backup/database-backup.sql
```

### Git visszaállítás:
```bash
# Visszaállás a backup pontra
git checkout backup-2026-01-21-full

# Vagy egy adott commit-ra
git checkout 2014cb5
```

### Adatbázis visszaállítás:
```bash
# 1. Backup fájl feltöltése
scp -i ~/.ssh/vsys-hetzner /Users/hollosigabor/Downloads/NewvSys/backup/2026-01-21-full-backup/database-backup.sql root@46.224.157.177:/tmp/

# 2. Visszaállítás
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec -i vsys-postgres psql -U vsys vsys_next < /tmp/database-backup.sql"

# 3. Konténerek újraindítása
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml restart"
```

---

## 11. FEJLESZTÉSI SZABÁLYOK

### Kódolási konvenciók:
- TypeScript strict mode
- Prisma minden DB művelethez
- NestJS decorator-based DI
- Next.js App Router (nem Pages Router)
- Tailwind CSS styling

### Commit üzenet formátum:
```
<type>: <description>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
Típusok: feat, fix, refactor, docs, backup, chore

### Deploy előtt mindig:
1. Tesztelés lokálisan
2. Git commit
3. rsync + docker rebuild

---

## 12. JELENLEGI ÁLLAPOT (2026-01-21)

### Működő funkciók:
- [x] Platform Admin teljes funkció
- [x] Network Admin regisztráció és kezelés
- [x] Partner kezelés
- [x] Sofőr regisztráció és kezelés
- [x] Operátor portál mosásokhoz
- [x] Email rendszer (összes típus)
- [x] Foglalás rendszer
- [x] Cím autocomplete magyar irányítószámokkal

### Fejlesztés alatt:
- [ ] Stripe fizetés integráció (előkészítve)
- [ ] SMS küldés (Twilio előkészítve)
- [ ] Push értesítések
- [ ] Riportok és statisztikák

### Ismert hibák:
- PWA container "unhealthy" státusz (de működik)
- Néhány TypeScript warning a build során

---

## 13. HASZNOS PARANCSOK

### Lokális fejlesztés:
```bash
cd /Users/hollosigabor/Downloads/NewvSys

# Backend indítása
npm run start:dev

# Frontend indítása
cd pwa && npm run dev

# Prisma studio
npx prisma studio

# Prisma migrate
npx prisma migrate dev
```

### Szerver ellenőrzés:
```bash
# Container státusz
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker ps"

# Disk usage
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "df -h"

# Memory
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "free -m"
```

### Hibakeresés:
```bash
# API logok
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-api --tail 200 -f"

# PWA logok
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-pwa --tail 200 -f"

# Database query
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec vsys-postgres psql -U vsys vsys_next -c 'SELECT * FROM \"Network\" LIMIT 5;'"
```

---

## 14. ÚJ BESZÉLGETÉS INDÍTÁSA

Amikor új Claude Code chatet nyitsz, egyszerűen írd:

> "Folytassuk a VSys Wash fejlesztését"

vagy

> "Olvass be mindent és folytassuk ahol abbahagytuk"

A CLAUDE.md automatikusan beolvasásra kerül és minden kontextus rendelkezésre áll.

---

**Utolsó frissítés:** 2026-01-21 19:45 CET
**Backup tag:** backup-2026-01-21-full
**Git commit:** 2014cb5
