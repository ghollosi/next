# VSys / Vemiax - Teljes Rendszer Visszaállítási Pont
## Verzió: v1.1.0-vemiax
## Dátum: 2026-01-09

---

# 1. ÁTTEKINTÉS

## Rendszer leírás
A VSys egy multi-tenant SaaS járműmosó menedzsment rendszer, amely most a **vemiax.com** domain alatt fut.

## Architektúra
```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Hetzner VPS (46.224.157.177)                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Nginx Reverse Proxy                 │   │
│  │  - www.vemiax.com → Landing Page                        │   │
│  │  - app.vemiax.com → PWA (port 3001)                     │   │
│  │  - api.vemiax.com → Backend API (port 3000)             │   │
│  │  - admin.vemiax.com → Platform Admin redirect           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                  │
│  ┌─────────────────────┐       ┌─────────────────────┐         │
│  │   Docker: vsys-app  │       │   Docker: vsys-pwa  │         │
│  │   NestJS Backend    │       │   Next.js PWA       │         │
│  │   Port: 3000        │       │   Port: 3001        │         │
│  └─────────────────────┘       └─────────────────────┘         │
│              │                                                   │
│              ▼                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Docker: vsys-postgres                       │   │
│  │              PostgreSQL 16                               │   │
│  │              Port: 5432                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. ELÉRHETŐSÉGEK ÉS URL-EK

## Domain: vemiax.com
**DNS Provider:** WebSupport.hu

| Subdomain | Cél | SSL |
|-----------|-----|-----|
| www.vemiax.com | Landing page | Let's Encrypt |
| app.vemiax.com | PWA alkalmazás | Let's Encrypt |
| api.vemiax.com | Backend API | Let's Encrypt |
| admin.vemiax.com | Platform Admin (redirect) | Let's Encrypt |

## Portok
- **3000** - NestJS Backend API
- **3001** - Next.js PWA
- **5432** - PostgreSQL

---

# 3. BELÉPÉSI ADATOK

## 3.1 Platform Admin (Rendszergazda)
**URL:** https://app.vemiax.com/platform-admin

| Email | Jelszó | Szerepkör |
|-------|--------|-----------|
| admin@vsys.hu | *(eredeti)* | PLATFORM_OWNER |

## 3.2 Network Admin (Hálózati admin)
**URL:** https://app.vemiax.com/network-admin

| Email | Hálózat | Szerepkör |
|-------|---------|-----------|
| gabhol@gmail.com | vsys-demo | NETWORK_OWNER |

## 3.3 Operator Portal (Mosó operátor)
**URL:** https://app.vemiax.com/operator-portal

| Helyszín kód | Helyszín név | PIN |
|--------------|--------------|-----|
| SZEKSZ | Szekszárd | 1234 |
| PECS1 | Pécs | 1234 |
| SZFVAR1 | Székesfehérvár | 1234 |
| BP01 | Budapest - Csepel | 1234 |
| GY01 | Győr - Ipari Park | 1234 |
| A2 | A2 Pihenő | 1234 |

## 3.4 Driver PWA (Sofőr alkalmazás)
**URL:** https://app.vemiax.com/login

| Meghívó kód | Név | PIN |
|-------------|-----|-----|
| 2BBE41 | Kovács István | 1234 |

---

# 4. SZERVER KONFIGURÁCIÓ

## 4.1 VPS adatok
- **Provider:** Hetzner
- **IP:** 46.224.157.177
- **OS:** Ubuntu
- **SSH:** `ssh root@46.224.157.177`

## 4.2 Docker konténerek
```bash
docker ps
# vsys-app     - Backend (port 3000)
# vsys-pwa     - PWA (port 3001)
# vsys-postgres - Database (port 5432)
```

## 4.3 Fájl elérési utak
```
/opt/vsys/              - Alkalmazás gyökér
/opt/vsys/.env          - Környezeti változók
/opt/vsys/docker-compose.yml
/var/www/vemiax/        - Landing page
/etc/nginx/sites-available/vemiax - Nginx config
```

---

# 5. EMAIL KONFIGURÁCIÓ

## SMTP beállítások (WebSupport.hu)
```
Host: smtp.websupport.hu
Port: 587
User: info@vemiax.com
Pass: Vemiax2026!
Secure: STARTTLS
```

## DNS rekordok (email)
```
MX   10  mx1.websupport.sk
MX   20  mx2.websupport.sk
TXT  v=spf1 include:_spf.websupport.sk ~all
TXT  _dmarc  v=DMARC1; p=none; rua=mailto:admin@vemiax.com
```

---

# 6. KÖRNYEZETI VÁLTOZÓK (.env)

```bash
# Database
DATABASE_URL="postgresql://vsys:vsys_dev_password@localhost:5432/vsys_next?schema=public"

# Application
NODE_ENV=development
PORT=3000
JWT_SECRET=change-me-in-production
LOG_LEVEL=debug

# Email (Resend - backup)
RESEND_API_KEY=re_YVXpiKdE_8y1HbhcUGeEzcZMRafE9KX4E

# Email (Primary - WebSupport SMTP)
SMTP_HOST=smtp.websupport.hu
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@vemiax.com
SMTP_PASS=Vemiax2026!
SMTP_FROM=info@vemiax.com
SMTP_FROM_NAME=Vemiax

# URLs
EMAIL_FROM_ADDRESS=info@vemiax.com
EMAIL_FROM_NAME=Vemiax
FRONTEND_URL=https://app.vemiax.com
API_URL=https://api.vemiax.com
```

---

# 7. VISSZAÁLLÍTÁSI LÉPÉSEK

## 7.1 Git visszaállítás
```bash
# Klónozás
git clone https://github.com/ghollosi/next.git vsys
cd vsys

# Visszaállítás erre a verzióra
git checkout v1.1.0-vemiax
```

## 7.2 Adatbázis visszaállítás
```bash
# Backup fájl helye: /tmp/vsys_db_backup_20260109.sql

# Visszaállítás
docker exec -i vsys-postgres psql -U vsys vsys_next < backup.sql
```

## 7.3 Szerver újraindítás
```bash
ssh root@46.224.157.177

cd /opt/vsys
docker compose down
docker compose up -d

# Nginx újraindítás
sudo systemctl restart nginx
```

## 7.4 SSL tanúsítványok megújítása
```bash
sudo certbot renew
```

---

# 8. NGINX KONFIGURÁCIÓ

Fájl: `/etc/nginx/sites-available/vemiax`

```nginx
# app.vemiax.com - PWA
server {
    listen 443 ssl;
    server_name app.vemiax.com;
    ssl_certificate /etc/letsencrypt/live/app.vemiax.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.vemiax.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# api.vemiax.com - Backend
server {
    listen 443 ssl;
    server_name api.vemiax.com;
    ssl_certificate /etc/letsencrypt/live/app.vemiax.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.vemiax.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# www.vemiax.com - Landing
server {
    listen 443 ssl;
    server_name www.vemiax.com;
    ssl_certificate /etc/letsencrypt/live/www.vemiax.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.vemiax.com/privkey.pem;

    root /var/www/vemiax;
    index index.html;
}
```

---

# 9. DOCKER COMPOSE

Fájl: `/opt/vsys/docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: vsys-postgres
    environment:
      POSTGRES_USER: vsys
      POSTGRES_PASSWORD: vsys_dev_password
      POSTGRES_DB: vsys_next
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: development
    container_name: vsys-app
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://vsys:vsys_dev_password@postgres:5432/vsys_next?schema=public
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - postgres

volumes:
  postgres_data:
```

---

# 10. BACKUP PARANCSOK

## Adatbázis backup
```bash
# Helyi mentés
ssh root@46.224.157.177 "docker exec vsys-postgres pg_dump -U vsys vsys_next" > backup_$(date +%Y%m%d).sql

# Szerveren
docker exec vsys-postgres pg_dump -U vsys vsys_next > /opt/backups/vsys_$(date +%Y%m%d).sql
```

## Teljes alkalmazás backup
```bash
# Kód
tar -czf vsys_code_$(date +%Y%m%d).tar.gz /opt/vsys

# Nginx config
cp /etc/nginx/sites-available/vemiax /opt/backups/

# Landing page
tar -czf landing_$(date +%Y%m%d).tar.gz /var/www/vemiax
```

---

# 11. HIBAKERESÉS

## Log megtekintés
```bash
# Backend logok
docker logs vsys-app -f

# PWA logok
docker logs vsys-pwa -f

# Nginx logok
tail -f /var/log/nginx/error.log
```

## Szolgáltatások ellenőrzése
```bash
# Docker státusz
docker ps

# Nginx státusz
systemctl status nginx

# Port ellenőrzés
netstat -tlnp | grep -E '3000|3001|5432'
```

## Email teszt
```bash
# SMTP teszt
swaks --to test@example.com \
      --from info@vemiax.com \
      --server smtp.websupport.hu:587 \
      --auth LOGIN \
      --auth-user info@vemiax.com \
      --auth-password 'Vemiax2026!' \
      --tls
```

---

# 12. FONTOS MEGJEGYZÉSEK

1. **SSL tanúsítványok** automatikusan megújulnak (Let's Encrypt/Certbot)
2. **Email küldés** elsődlegesen SMTP-n keresztül, fallback Resend API
3. **Adatbázis** Docker volume-ban perzisztálva
4. **Git tag**: `v1.1.0-vemiax` - visszaállítási pont

---

# 13. KAPCSOLAT

- **Domain provider:** WebSupport.hu
- **VPS provider:** Hetzner
- **GitHub repo:** https://github.com/ghollosi/next
- **Support email:** info@vemiax.com

---

*Dokumentum készült: 2026-01-09*
*Verzió: v1.1.0-vemiax*
