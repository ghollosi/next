# VSys Wash - Session Handoff Document
**Dátum:** 2026-01-28 18:00 CET
**Branch:** `strange-elion`
**Utolsó commit:** `fc51642` - revert: Remove Unified Login feature

---

## 1. PROJEKT ÁTTEKINTÉS

**VSys Wash** - Többhálózatos autómosó menedzsment rendszer (multi-tenant SaaS).

### Tech Stack
- **Backend:** NestJS + Prisma + PostgreSQL
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Infrastruktúra:** Docker + Hetzner VPS + Nginx
- **Repository:** https://github.com/ghollosi/next.git

---

## 2. SZERVER ÉS DEPLOYMENT

### Szerver adatok
```
IP: 46.224.157.177
SSH Key: ~/.ssh/vsys-hetzner
User: root
Directory: /root/vsys-next
Docker Compose: docker-compose.full.yml
```

### URLs
```
Landing page:   https://www.vemiax.com
PWA (Frontend): https://app.vemiax.com
API (Backend):  https://api.vemiax.com
```

### Docker containers
```
vsys-api      - NestJS backend (port 3000)
vsys-pwa      - Next.js frontend (port 3001)
vsys-postgres - PostgreSQL 16 database
umami         - Analytics (port 3002)
```

### Deploy parancsok
```bash
# 1. Fájlok szinkronizálása
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='.next' --exclude='backup' --exclude='.env' -e "ssh -i ~/.ssh/vsys-hetzner" /Users/hollosigabor/.claude-worktrees/NewvSys/strange-elion/ root@46.224.157.177:/root/vsys-next/

# 2. API újraépítés
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml build --no-cache api && docker compose -f docker-compose.full.yml up -d api"

# 3. PWA újraépítés
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml build --no-cache pwa && docker compose -f docker-compose.full.yml up -d pwa"

# 4. Státusz ellenőrzés
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# 5. Logok
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-api --tail 100"
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-pwa --tail 100"
```

### ⚠️ SOHA NE HASZNÁLD
```
docker compose down -v        # -v TÖRLI AZ ADATBÁZIST!
/opt/vsys/                    # Régi könyvtár
docker-compose.yml            # Rossz fájl!
```

---

## 3. ADATBÁZIS

### Kapcsolat
```
Host: vsys-postgres (docker network)
Database: vsys_next
User: vsys
Password: vsys_staging_password
```

### Backup parancsok
```bash
# Backup létrehozása
DATE=$(date +%Y-%m-%d)
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec vsys-postgres pg_dump -U vsys vsys_next" > backup/database-backup-${DATE}.sql

# Ellenőrzés (88000+ sor elvárt)
wc -l backup/database-backup-${DATE}.sql
```

### Legutóbbi backup
- **Fájl:** `backup/database-backup-2026-01-28-post-revert.sql`
- **Méret:** 88754 sor
- **Állapot:** Unified Login revert UTÁN

---

## 4. BEJELENTKEZÉSI RENDSZER (JELENLEGI ÁLLAPOT)

### ✅ MŰKÖDŐ - Külön login oldalak portálonként

| Portál | Login URL | Auth típus |
|--------|-----------|------------|
| Platform Admin | `/platform-admin` | Email + jelszó |
| Network Admin | `/network-admin` | Email + jelszó + slug |
| Operator | `/operator-portal/login` | Email + jelszó |
| Partner | `/partner/login` | Telefon + PIN |
| Driver (Sofőr) | `/login` | Email + jelszó |

### ❌ VISSZAVONT - Unified Login
A `103eb1a` commitban bevezetett unified login feature visszavonásra került (`fc51642`), mert:
1. Next.js bundler hibásan minifikálta a localStorage kulcsokat
2. Token refresh logika felesleges kijelentkezéseket okozott
3. Session kezelési konfliktusok a legacy és unified rendszer között

---

## 5. FELHASZNÁLÓI ADATOK

### Platform Adminok
| Email | Jelszó | Megjegyzés |
|-------|--------|------------|
| admin@vsys.hu | AdminPass123 | Platform Owner |
| gabhol@gmail.com | (meglévő) | Platform Admin |
| gabor.hollosi@vedox.hu | (meglévő) | Platform Owner |
| gkocsis@5times.hu | (meglévő) | Platform Admin |

### Network Adminok
| Email | Network Slug |
|-------|--------------|
| gabor.hollosi@vedox.hu | g-wash |
| katabene@gmail.com | k-wash |
| katalin@molinovillas.com | kata-moso |
| gabhol@gmail.com | vemiax-test, vsys-demo |

### Operátorok (vsys-demo network)
- a2.operator@demo.vemiax.com
- boly.operator@demo.vemiax.com
- bp01.operator@demo.vemiax.com
- gy01.operator@demo.vemiax.com
- stb...
- **Jelszó:** Demo1234!

### Sofőrök
- balogh.ferenc@email.hu (vemiax-test)
- kovacs.istvan@example.com (vsys-demo)
- stb...
- **Jelszó:** Demo1234!

---

## 6. PROJEKT STRUKTÚRA

```
/Users/hollosigabor/.claude-worktrees/NewvSys/strange-elion/
├── src/                          # NestJS Backend
│   ├── platform-admin/           # Platform Admin API
│   ├── network-admin/            # Network Admin API
│   ├── operator-portal/          # Operator API
│   ├── partner-portal/           # Partner API
│   ├── pwa/                      # PWA (Driver) API
│   ├── ai-chat/                  # Émi AI Chat modul
│   └── modules/                  # Közös modulok
│
├── pwa/                          # Next.js Frontend
│   └── src/
│       ├── app/
│       │   ├── platform-admin/   # Platform Admin UI
│       │   ├── network-admin/    # Network Admin UI
│       │   ├── operator-portal/  # Operator UI
│       │   ├── partner/          # Partner UI
│       │   ├── login/            # Sofőr login
│       │   └── ...
│       └── lib/
│           ├── platform-api.ts   # Platform Admin API client
│           ├── network-admin-api.ts
│           ├── api.ts            # Driver API client
│           └── session.ts        # Session management
│
├── prisma/
│   └── schema.prisma             # Adatbázis séma
│
├── backup/                       # Backup fájlok
│   └── database-backup-2026-01-28-post-revert.sql
│
├── docker-compose.full.yml       # Production docker config
├── CLAUDE.md                     # Fő projekt dokumentáció
└── SESSION-HANDOFF-2026-01-28.md # Ez a fájl
```

---

## 7. GIT ÁLLAPOT

### Branch: `strange-elion`
```
fc51642 revert: Remove Unified Login feature - return to separate portal logins
103eb1a feat: Unified Login - single login page for all user roles
7e0f524 backup: Full system backup before Unified Login feature
7a2f0f7 backup: Full system backup before Unified Login feature
21c3915 feat: Add Umami analytics dashboard + fix plate number display
50ef89a fix(security): LOW severity fixes - session cleanup + password policy
19acfef fix(security): MEDIUM severity - hash reset tokens in all portals
dc97d43 fix(security): HIGH severity audit fixes (H1-H5)
```

### Fontos commitok
- `fc51642` - **JELENLEGI** - Unified Login visszavonva
- `7a2f0f7` - Utolsó stabil állapot Unified Login ELŐTT
- `dc97d43` - Security audit javítások

---

## 8. ISMERT PROBLÉMÁK / FIGYELMEZTETÉSEK

### 1. Next.js Bundler Minifikáció Bug
A Next.js bundler hibásan minifikálja a localStorage kulcsokat tartalmazó változókat.
**Megoldás:** Közvetlen string literal használata `localStorage.setItem('key', value)` formában, NEM változón keresztül.

### 2. Token Refresh Logika
A `platform-api.ts` `isTokenExpiringSoon()` függvénye `true`-t adott vissza ha nincs expiry info, ami felesleges token refresh-et triggerelt.
**Jelenlegi állapot:** Az eredeti verzióra visszaállítva (7a2f0f7 commit).

### 3. CORS beállítások
Ha új domain-t kell hozzáadni, frissítsd a `docker-compose.full.yml` CORS_ORIGIN környezeti változóját:
```yaml
CORS_ORIGIN: "https://app.vemiax.com,https://api.vemiax.com,https://www.vemiax.com"
```

---

## 9. KÖVETKEZŐ FELADATOK (OPCIONÁLIS)

### Terv fájl létezik
A `/Users/hollosigabor/.claude/plans/elegant-honking-adleman.md` fájlban van egy terv:
- Jármű hozzáadás mosás regisztráláskor
- Járművek szerkesztése/törlése

### Prioritások
1. Tesztelni a jelenlegi bejelentkezési rendszert minden portálon
2. Ha minden működik, folytatható a jármű feature fejlesztése
3. Unified Login feature újragondolása más megközelítéssel (ha szükséges)

---

## 10. TESZTELÉSI CHECKLIST

### Platform Admin (/platform-admin)
- [ ] Bejelentkezés: admin@vsys.hu / AdminPass123
- [ ] Dashboard betölt
- [ ] Hálózatok oldal működik
- [ ] Analytics oldal működik
- [ ] Audit napló működik
- [ ] Adminok oldal működik
- [ ] Beállítások működik

### Network Admin (/network-admin)
- [ ] Bejelentkezés működik
- [ ] Dashboard betölt
- [ ] Helyszínek kezelés
- [ ] Sofőrök kezelés
- [ ] Partnerek kezelés

### Operator (/operator-portal/login)
- [ ] Bejelentkezés működik
- [ ] Új mosás rögzítése
- [ ] Foglalások kezelése

### Driver (/login)
- [ ] Bejelentkezés működik
- [ ] Dashboard betölt
- [ ] Mosás indítása
- [ ] Járművek kezelése

---

## 11. BACKUP ELLENŐRZŐLISTA

| Tétel | Státusz | Fájl |
|-------|---------|------|
| Git commit | ✅ | fc51642 |
| Git push | ✅ | origin/strange-elion |
| DB backup | ✅ | database-backup-2026-01-28-post-revert.sql |
| Szerver deploy | ✅ | Containers running |

---

## 12. PARANCS ÖSSZEFOGLALÓ

### Gyors deploy (ha csak frontend változott)
```bash
cd /Users/hollosigabor/.claude-worktrees/NewvSys/strange-elion/pwa && npm run build && cd .. && rsync -avz --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='.next' --exclude='backup' --exclude='.env' -e "ssh -i ~/.ssh/vsys-hetzner" ./ root@46.224.157.177:/root/vsys-next/ && ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml build --no-cache pwa && docker compose -f docker-compose.full.yml up -d pwa"
```

### Teljes rebuild (API + PWA)
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml build --no-cache && docker compose -f docker-compose.full.yml up -d"
```

### DB konzol
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 'docker exec -it vsys-postgres psql -U vsys vsys_next'
```

---

**FONTOS:** A CLAUDE.md fájl tartalmazza a részletes projekt dokumentációt. Ez a handoff dokumentum kiegészíti azt a mai session specifikus információival.
