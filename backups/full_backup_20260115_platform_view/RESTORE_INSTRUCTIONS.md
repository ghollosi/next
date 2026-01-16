# Visszaallitasi utmutato - 2026.01.15 Platform View Backup

## Backup informacio

- **Datum:** 2026. januar 15.
- **Git commit:** 674da0e
- **Leiras:** Platform Admin invisible Network view mode feature

## Tartalmazott fajlok

- `database_dump.sql` - Teljes PostgreSQL adatbazis dump
- `prisma/` - Prisma schema es migraciok
- `src/` - Backend NestJS forraskod
- `pwa_src/` - Frontend Next.js forraskod
- `package.json` - Projekt fuggosegek
- `docker-compose.full.yml` - Docker konfiguracio

## Visszaallitas modja

### 1. Kod visszaallitasa Git-bol

```bash
# Visszaallas erre a commitra
cd /Users/hollosigabor/Downloads/NewvSys
git checkout 674da0e

# VAGY uj branch letrehozasa ebbol az allapotbol
git checkout -b restore-platform-view 674da0e
```

### 2. Adatbazis visszaallitasa

**FONTOS: Ez TORLI az osszes jelenlegi adatot!**

```bash
# 1. Csatlakozas a szerverre
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177

# 2. Adatbazis torles es ujraletrehozas
cd /root/vsys-next
docker compose -f docker-compose.full.yml exec postgres psql -U vsys -c "DROP DATABASE IF EXISTS vsys_next;"
docker compose -f docker-compose.full.yml exec postgres psql -U vsys -c "CREATE DATABASE vsys_next;"

# 3. Backup visszatoltese (lokalis geprol)
# Eloszor masolj fel a dump fajlt:
scp -i ~/.ssh/vsys-hetzner /Users/hollosigabor/Downloads/NewvSys/backups/full_backup_20260115_platform_view/database_dump.sql root@46.224.157.177:/root/

# Majd a szerveren:
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177
cat /root/database_dump.sql | docker compose -f docker-compose.full.yml exec -T postgres psql -U vsys vsys_next
```

### 3. Alkalmazas ujrainditasa

```bash
# A szerveren
cd /root/vsys-next
docker compose -f docker-compose.full.yml down
docker compose -f docker-compose.full.yml up -d --build
```

### 4. Lokalis kod szinkronizalasa

```bash
# Lokalis geprol
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' --exclude 'backups' -e "ssh -i ~/.ssh/vsys-hetzner" /Users/hollosigabor/Downloads/NewvSys/ root@46.224.157.177:/root/vsys-next/

# FONTOS: .env ujraletrehozasa a szerveren (mert rsync felulirja)
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cat > /root/vsys-next/.env << 'EOF'
POSTGRES_USER=vsys
POSTGRES_PASSWORD=vsys_staging_password
POSTGRES_DB=vsys_next
JWT_SECRET=K8xPmN2vQ9wR4tY7uI0oL3jH6gF5dS8aZ1xC4vB7nM2kJ9pQ6wE3rT0yU5iO8lA1
SMTP_HOST=smtp.websupport.hu
SMTP_PORT=587
SMTP_USER=info@vemiax.com
SMTP_PASS=Vemiax2026!
NODE_ENV=production
EOF"

# Majd ujraepites
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

## Fontos megjegyzesek

- A backup a `vsys_platform_view` localStorage key javitasat tartalmazza
- A Platform View funkcio lehetove teszi, hogy a Platform Admin lathatatlanul megtekintse a Network Admin oldalakat
- A Network Adminok nem latjak a Platform Admin tevekenysegeit sem a megtekintek oldalon, sem az audit logban

## Ellenorzes visszaallitas utan

1. Platform Admin bejelentkezes: https://app.vemiax.com/platform-admin
2. Networks oldal megnyitasa
3. "Megtekintes" gomb tesztelese barmelyik networknel
4. Network Admin oldalak ellenorzese Platform View modban
