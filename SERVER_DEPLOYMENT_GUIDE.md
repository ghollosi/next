# VSys Server Deployment Guide

## Szerver Információk

| Tulajdonság | Érték |
|-------------|-------|
| **IP cím** | `46.224.157.177` |
| **Hostname** | `vsys-staging-01` |
| **OS** | Ubuntu 22.04 LTS (Linux 5.15.0) |
| **Szolgáltató** | Hetzner |

---

## SSH Hozzáférés

```bash
# SSH kapcsolat
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177

# SSH kulcs helye (lokális gépen)
~/.ssh/vsys-hetzner
```

---

## Könyvtárstruktúra

```
/root/vsys-next/                    # Fő projekt könyvtár
├── docker-compose.full.yml         # Docker Compose konfiguráció
├── .env                            # Környezeti változók
├── Dockerfile                      # API Dockerfile
├── prisma/                         # Prisma schema és migrációk
├── src/                            # NestJS backend forráskód
├── pwa/                            # Next.js PWA frontend
│   └── Dockerfile                  # PWA Dockerfile
├── dist/                           # Buildelt API
├── backups/                        # Backup fájlok
│   └── 20260109/
│       ├── vsys_db_backup_20260109.sql
│       ├── nginx_config_backup.txt
│       └── server_env_backup.txt
└── landing-page/                   # Landing page statikus fájlok
```

---

## Docker Konténerek

| Konténer | Image | Port | Leírás |
|----------|-------|------|--------|
| `vsys-api` | `vsys-next-api` | 3000 | NestJS Backend API |
| `vsys-pwa` | `vsys-next-pwa` | 3001 | Next.js PWA Frontend |
| `vsys-postgres` | `postgres:16-alpine` | 5432 (internal) | PostgreSQL adatbázis |

### Docker parancsok

```bash
# Konténerek státusza
docker ps

# Összes konténer újraépítése és indítása
cd /root/vsys-next
docker compose -f docker-compose.full.yml up -d --build

# Csak API újraépítése
docker compose -f docker-compose.full.yml up -d --build api

# Csak PWA újraépítése
docker compose -f docker-compose.full.yml up -d --build pwa

# API restart (env változók újratöltése)
docker compose -f docker-compose.full.yml restart api

# Logok megtekintése
docker logs vsys-api --tail 50
docker logs vsys-pwa --tail 50
docker logs vsys-postgres --tail 50

# Konténerbe belépés
docker exec -it vsys-api sh
docker exec -it vsys-postgres psql -U vsys -d vsys_next
```

---

## Adatbázis

### Kapcsolati adatok

| Tulajdonság | Érték |
|-------------|-------|
| **Host** | `postgres` (Docker network) / `localhost` (host) |
| **Port** | 5432 |
| **Database** | `vsys_next` |
| **User** | `vsys` |
| **Password** | `vsys_staging_password` |

### DATABASE_URL
```
postgresql://vsys:vsys_staging_password@postgres:5432/vsys_next?schema=public
```

### Adatbázis parancsok

```bash
# Belépés az adatbázisba
docker exec -it vsys-postgres psql -U vsys -d vsys_next

# Táblák listázása
docker exec vsys-postgres psql -U vsys -d vsys_next -c "\dt"

# SQL parancs futtatása
docker exec vsys-postgres psql -U vsys -d vsys_next -c "SELECT * FROM networks;"

# Backup készítése
docker exec vsys-postgres pg_dump -U vsys vsys_next > backup_$(date +%Y%m%d).sql

# Backup visszaállítása
cat backup.sql | docker exec -i vsys-postgres psql -U vsys -d vsys_next

# Adatbázis teljes újraépítése backupból
docker exec vsys-postgres psql -U vsys -d postgres -c "DROP DATABASE IF EXISTS vsys_next;"
docker exec vsys-postgres psql -U vsys -d postgres -c "CREATE DATABASE vsys_next;"
cat backup.sql | docker exec -i vsys-postgres psql -U vsys -d vsys_next
```

### Prisma parancsok

```bash
# Migrációk futtatása (konténerben automatikus induláskor)
docker exec vsys-api npx prisma migrate deploy

# Schema push (migrációk nélkül - DEV ONLY)
docker exec vsys-api npx prisma db push

# Prisma Studio (lokálisan)
npx prisma studio
```

---

## Nginx Konfiguráció

### Fájl helye
```
/etc/nginx/sites-available/vemiax
/etc/nginx/sites-enabled/vemiax -> /etc/nginx/sites-available/vemiax
```

### Domain routing

| Domain | Cél | Port |
|--------|-----|------|
| `app.vemiax.com` | PWA Frontend | 3001 |
| `api.vemiax.com` | Backend API | 3000 |
| `admin.vemiax.com` | Redirect -> app.vemiax.com/platform-admin | - |
| `www.vemiax.com` | Landing page | /var/www/vemiax |
| `vemiax.com` | Redirect -> www.vemiax.com | - |

### Nginx parancsok

```bash
# Konfiguráció tesztelése
nginx -t

# Nginx újratöltése
systemctl reload nginx

# Nginx újraindítása
systemctl restart nginx

# Nginx státusz
systemctl status nginx
```

---

## SSL Tanúsítványok (Let's Encrypt)

### Tanúsítvány helyek
```
/etc/letsencrypt/live/app.vemiax.com/
├── fullchain.pem
└── privkey.pem

/etc/letsencrypt/live/www.vemiax.com/
├── fullchain.pem
└── privkey.pem
```

### Certbot parancsok

```bash
# Új tanúsítvány
certbot --nginx -d app.vemiax.com -d api.vemiax.com

# Tanúsítvány megújítása
certbot renew

# Tanúsítvány státusz
certbot certificates
```

---

## Környezeti Változók

### docker-compose.full.yml environment szekció (API)

```yaml
environment:
  DATABASE_URL: postgresql://vsys:vsys_staging_password@postgres:5432/vsys_next?schema=public
  NODE_ENV: production
  PORT: 3000
  LOG_LEVEL: info
  CORS_ORIGIN: https://app.vemiax.com,https://vsys.vemiax.com,https://api.vemiax.com
```

### .env fájl (kiegészítő)

```bash
# /root/vsys-next/.env
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://vsys:vsys_dev_password@postgres:5432/vsys_next?schema=public"
JWT_SECRET=vsys-next-dev-secret-change-in-production
CORS_ORIGIN=https://app.vemiax.com,https://vsys.vemiax.com
LOG_LEVEL=info
```

**FONTOS**: A `docker-compose.full.yml` `environment` szekciója felülírja az `.env` fájl értékeit!

---

## Felhasználók és Jelszavak

### Platform Admin
| Mező | Érték |
|------|-------|
| **Email** | `admin@vsys.hu` |
| **Jelszó** | `AdminPass123` |
| **Role** | `PLATFORM_OWNER` |

### Jelszó visszaállítása

```bash
# Platform Admin jelszó visszaállítása
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 '
NEW_HASH=$(docker exec vsys-api node -e "const bcrypt = require(\"bcrypt\"); console.log(bcrypt.hashSync(\"UJ_JELSZO\", 10));")
docker exec vsys-postgres psql -U vsys -d vsys_next -c "UPDATE platform_admins SET password_hash = '\''$NEW_HASH'\'' WHERE email = '\''admin@vsys.hu'\'';"
'
```

---

## Deployment Folyamat

### 1. Lokális build és teszt

```bash
cd /Users/hollosigabor/Downloads/NewvSys

# Backend build
npm run build

# PWA build
cd pwa && npm run build && cd ..
```

### 2. Kód szinkronizálása a szerverre

```bash
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '.next' \
  --exclude 'backup' \
  -e "ssh -i ~/.ssh/vsys-hetzner" \
  /Users/hollosigabor/Downloads/NewvSys/ \
  root@46.224.157.177:/root/vsys-next/
```

### 3. Konténerek újraépítése

```bash
# Csak API
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 \
  "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build api"

# Csak PWA
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 \
  "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build pwa"

# Mindkettő
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 \
  "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

### 4. Ellenőrzés

```bash
# Konténerek státusza
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker ps"

# API logok
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-api --tail 20"

# API health check
curl https://api.vemiax.com/health

# PWA elérhetőség
curl -s -o /dev/null -w "%{http_code}" https://app.vemiax.com
```

---

## Hibaelhárítás

### "Failed to fetch" hiba a frontenden
- **Ok**: CORS nincs beállítva
- **Megoldás**: Ellenőrizd a `CORS_ORIGIN` környezeti változót a docker-compose.full.yml-ben

### Konténer unhealthy
- **Ok**: Healthcheck timeout vagy alkalmazás nem indult el
- **Megoldás**: `docker logs <container_name>` - logok ellenőrzése

### Adatbázis kapcsolat hiba
- **Ok**: Rossz DATABASE_URL vagy postgres konténer nem fut
- **Megoldás**:
  ```bash
  docker ps | grep postgres
  docker logs vsys-postgres
  ```

### Prisma migráció hiba
- **Megoldás**:
  ```bash
  docker exec vsys-api npx prisma migrate deploy
  # vagy schema push (óvatosan!)
  docker exec vsys-api npx prisma db push
  ```

---

## Backup és Restore

### Teljes backup készítése

```bash
# Adatbázis
docker exec vsys-postgres pg_dump -U vsys vsys_next > /root/vsys-next/backups/vsys_db_$(date +%Y%m%d_%H%M%S).sql

# Nginx config
cp /etc/nginx/sites-available/vemiax /root/vsys-next/backups/nginx_$(date +%Y%m%d).conf
```

### Restore backupból

```bash
# Adatbázis visszaállítása
docker exec vsys-postgres psql -U vsys -d postgres -c "DROP DATABASE IF EXISTS vsys_next;"
docker exec vsys-postgres psql -U vsys -d postgres -c "CREATE DATABASE vsys_next;"
cat backup.sql | docker exec -i vsys-postgres psql -U vsys -d vsys_next

# Prisma schema szinkronizálása
docker exec vsys-api npx prisma db push
```

---

## URL-ek

| Szolgáltatás | URL |
|--------------|-----|
| **PWA (App)** | https://app.vemiax.com |
| **Platform Admin** | https://app.vemiax.com/platform-admin |
| **Network Admin** | https://app.vemiax.com/network-admin |
| **API** | https://api.vemiax.com |
| **API Docs (Swagger)** | https://api.vemiax.com/api/docs |
| **Landing Page** | https://www.vemiax.com |

---

## Docker Volume

**Aktív volume**: `vsys_postgres_data`

```bash
# Volume listázása
docker volume ls

# Volume részletei
docker volume inspect vsys_postgres_data
```

**FIGYELEM**: A volume neve a docker-compose fájl könyvtárától függ! Ha más könyvtárból indítod, új volume jön létre!

---

*Utolsó frissítés: 2026-01-14*
