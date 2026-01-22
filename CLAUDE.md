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
- **Émi AI Asszisztens** - Anthropic Claude alapú chat segéd

### Tech Stack:
- **Backend:** NestJS + Prisma + PostgreSQL
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Infrastruktúra:** Docker + Hetzner VPS + Nginx (reverse proxy)
- **Email:** SMTP (smtp.websupport.hu)
- **AI:** Anthropic Claude API (Émi asszisztens)
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
Landing page:   https://www.vemiax.com
PWA (Frontend): https://app.vemiax.com
API (Backend):  https://api.vemiax.com
```

### Docker containers:
```
vsys-api      - NestJS backend (port 3000)
vsys-pwa      - Next.js frontend (port 3001)
vsys-postgres - PostgreSQL 16 database
```

### Deploy folyamat (TELJES):

#### 1. Fájlok szinkronizálása:
```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' --exclude '.env' \
  -e "ssh -i ~/.ssh/vsys-hetzner" \
  /Users/hollosigabor/Downloads/NewvSys/ \
  root@46.224.157.177:/root/vsys-next/
```

#### 2. API újraépítés és indítás:
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build api"
```

#### 3. PWA újraépítés és indítás:
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build pwa"
```

#### 4. Státusz ellenőrzés:
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml ps"
```

#### 5. Logok megtekintése:
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-pwa --tail 100"
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-api --tail 100"
```

#### 6. Gyors újraindítás (rebuild nélkül):
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml restart pwa"
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml restart api"
```

### Deploy szabályok:
1. **Mindig git commit ELŐTT deploy** - változtatások mentve legyenek
2. **Backup készítés nagy változások előtt** - adatbázis + fájlok
3. **Tesztelés lokálisan** - `npm run build` sikeres legyen
4. **CORS ellenőrzés** - új domain esetén `docker-compose.full.yml` frissítése
5. **Landing page (www.vemiax.com)** - fájlok: `/var/www/vemiax/`

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
# Adatbázis backup
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec vsys-postgres pg_dump -U vsys vsys_next" > backup.sql

# Landing page backup
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "tar -czf - /var/www/vemiax" > landing-backup.tar.gz

# Nginx config backup
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cat /etc/nginx/sites-available/vemiax" > nginx-backup.conf
```

### Teljes backup visszaállítás:
```bash
# 1. Git checkout a backup tag-re
git checkout backup-2026-01-22-emi-registration

# 2. Adatbázis backup feltöltése
scp -i ~/.ssh/vsys-hetzner backup.sql root@46.224.157.177:/tmp/

# 3. Adatbázis visszaállítás (VIGYÁZAT - felülírja az adatokat!)
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec -i vsys-postgres psql -U vsys vsys_next < /tmp/backup.sql"

# 4. Kód szinkronizálás és rebuild
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' --exclude '.env' \
  -e "ssh -i ~/.ssh/vsys-hetzner" \
  /Users/hollosigabor/Downloads/NewvSys/ \
  root@46.224.157.177:/root/vsys-next/

# 5. Konténerek újraépítése
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
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

# AI Chat
ANTHROPIC_API_KEY=sk-ant-api03-...

# URLs (docker-compose.full.yml-ben is!)
CORS_ORIGIN=https://app.vemiax.com,https://vsys.vemiax.com,https://api.vemiax.com,https://www.vemiax.com,https://vemiax.com
NEXT_PUBLIC_API_URL=https://api.vemiax.com
FRONTEND_URL=https://app.vemiax.com
DEFAULT_NETWORK_ID=cf808392-6283-4487-9fbd-e72951ca5bf8
```

---

## 5. PROJEKT STRUKTÚRA

```
/Users/hollosigabor/Downloads/NewvSys/
├── src/                          # NestJS Backend
│   ├── ai-chat/                  # Émi AI Chat modul
│   ├── modules/
│   │   ├── booking/              # Foglalások
│   │   ├── driver/               # Sofőrök
│   │   ├── email/                # Email küldés
│   │   ├── location/             # Helyszínek
│   │   ├── wash-event/           # Mosási események
│   │   └── ...
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
│       │   ├── register/         # Sofőr regisztráció
│       │   └── (driver pages)    # Sofőr UI
│       ├── components/
│       │   └── EmiChatWidget.tsx # AI Chat komponens
│       └── lib/                  # API hívások, utils
│
├── prisma/
│   └── schema.prisma             # Adatbázis séma
│
├── backup/                       # Backup fájlok
│   └── 2026-01-22-full-backup/   # Legutóbbi teljes backup
│
├── docker-compose.full.yml       # Production docker config
└── CLAUDE.md                     # Ez a fájl
```

---

## 6. ÉMI AI ASSZISZTENS

### Működése:
- **Anthropic Claude** (claude-3-haiku) alapú
- Magyar és angol nyelv támogatása
- Szerepkör-specifikus válaszok
- Gyors válaszok gyakori kérdésekre (API hívás nélkül)
- Dinamikus kontextus adatbázisból

### API végpontok:
```
POST /ai-chat/public          # Vendégek (nem bejelentkezett)
POST /ai-chat/authenticated   # Bejelentkezett felhasználók
```

### Felhasználói szerepkörök:
- **guest** - Vendég (landing page)
- **driver** - Sofőr/Ügyfél (PWA)
- **operator** - Operátor (mosóhelyszín)
- **partner_admin** - Partner Admin (flottakezelő)
- **network_admin** - Network Admin
- **platform_admin** - Platform Admin

### Widget használata:
```tsx
import EmiChatWidget from '@/components/EmiChatWidget';

// Vendég (bejelentkezés nélkül)
<EmiChatWidget language="hu" primaryColor="#3b82f6" />

// Bejelentkezett felhasználó
<EmiChatWidget
  language="hu"
  primaryColor="#6366f1"
  userRole="driver"
  userId={session.driverId}
  networkId={session.networkId}
  token={session.token}
/>
```

### Standalone widget (www.vemiax.com):
```
Fájl: /var/www/vemiax/emi-widget.js
```

---

## 7. AUTHENTIKÁCIÓ

### Típusok:
1. **Platform Admin** - Email + jelszó (bcrypt)
2. **Network Admin** - Email + jelszó (bcrypt)
3. **Partner Admin** - Telefon + PIN
4. **Operator** - Telefon + PIN
5. **Driver (Sofőr)** - Email + jelszó VAGY Telefon + PIN

### Sofőr regisztráció:
- **Privát ügyfél** - Email + jelszó + számlázási adatok → azonnali hozzáférés
- **Céges sofőr** - Partner kiválasztása → jóváhagyásra vár

### Helyszín láthatóság:
- **Privát ügyfél** - ÖSSZES network ÖSSZES PUBLIC helyszíne
- **Flottás sofőr** - Saját network helyszínei (PUBLIC, NETWORK_ONLY, DEDICATED)

---

## 8. VISSZAÁLLÍTÁSI PONTOK

### Legutóbbi backup:
```
Tag: backup-2026-01-22-emi-registration
Commit: 66a7ad9
Dátum: 2026-01-22 15:12 CET
Fájlok: backup/2026-01-22-full-backup/
  - database-backup.sql (9.6 MB, 88132 sor)
  - www-vemiax-landing.tar.gz (143 KB)
  - nginx-vemiax.conf
  - server-env.txt
```

### Korábbi backup:
```
Tag: backup-2026-01-21-full
Commit: 2014cb5
Dátum: 2026-01-21 19:43 CET
```

### Git visszaállítás:
```bash
# Visszaállás a backup pontra
git checkout backup-2026-01-22-emi-registration

# Vagy egy adott commit-ra
git checkout 66a7ad9
```

---

## 9. JELENLEGI ÁLLAPOT (2026-01-22)

### Működő funkciók:
- [x] Platform Admin teljes funkció
- [x] Network Admin regisztráció és kezelés
- [x] Partner kezelés
- [x] Sofőr önregisztráció (email+jelszó)
- [x] Operátor portál mosásokhoz
- [x] Email rendszer (összes típus)
- [x] Foglalás rendszer
- [x] Cross-network helyszín hozzáférés (privát ügyfelek)
- [x] Émi AI Chat (landing page, PWA főoldal)
- [x] CORS támogatás www.vemiax.com-hoz

### Fejlesztés alatt:
- [ ] Émi integráció minden portálba
- [ ] Stripe fizetés integráció
- [ ] SMS küldés (Twilio)
- [ ] Push értesítések
- [ ] Riportok és statisztikák

---

## 10. HASZNOS PARANCSOK

### Lokális fejlesztés:
```bash
cd /Users/hollosigabor/Downloads/NewvSys

# Backend indítása
npm run start:dev

# Frontend indítása
cd pwa && npm run dev

# Build tesztelés
npm run build
cd pwa && npm run build
```

### Szerver ellenőrzés:
```bash
# Container státusz
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker ps"

# API logok real-time
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-api --tail 200 -f"

# Nginx logok
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "tail -100 /var/log/nginx/error.log"

# CORS ellenőrzés
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec vsys-api env | grep CORS"
```

---

## 11. ÚJ BESZÉLGETÉS INDÍTÁSA

Amikor új Claude Code chatet nyitsz, egyszerűen írd:

> "Folytassuk a VSys Wash fejlesztését"

vagy

> "Olvass be mindent és folytassuk ahol abbahagytuk"

A CLAUDE.md automatikusan beolvasásra kerül és minden kontextus rendelkezésre áll.

---

**Utolsó frissítés:** 2026-01-22 15:15 CET
**Backup tag:** backup-2026-01-22-emi-registration
**Git commit:** 66a7ad9
