# VSys Next - Deployment es Visszaallitasi Utmutato

**Utolso frissites:** 2026. januar 16.
**Aktualis commit:** b171ca5

---

## 1. SZERVER INFORMACIOK

| Kulcs | Ertek |
|-------|-------|
| Szerver IP | `46.224.157.177` |
| SSH User | `root` |
| SSH Kulcs | `~/.ssh/vsys-hetzner` |
| Projekt konyvtar | `/root/vsys-next` |
| Docker Compose fajl | `docker-compose.full.yml` |
| Adatbazis | PostgreSQL 16 |
| DB User | `vsys` |
| DB Nev | `vsys_next` |

---

## 2. LOKALIS UTVONALAK

| Leiras | Utvonal |
|--------|---------|
| Projekt gyoker | `/Users/hollosigabor/Downloads/NewvSys` |
| Backupok | `/Users/hollosigabor/Downloads/NewvSys/backups/` |
| Legutobbi backup | `/Users/hollosigabor/Downloads/NewvSys/backups/full_backup_20260115_platform_view/` |

---

## 3. SSH CSATLAKOZAS

```bash
# Csatlakozas a szerverhez
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177

# Teszt (ha nem mukodik, ellenorizd a kulcsot)
ssh -i ~/.ssh/vsys-hetzner -o ConnectTimeout=10 root@46.224.157.177 "echo 'SSH OK'"
```

---

## 4. DEPLOYMENT (Kod frissites)

### 4.1 Fajlok szinkronizalasa

```bash
rsync -avz \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '.next' \
  --exclude 'backup' \
  --exclude 'backups' \
  -e "ssh -i ~/.ssh/vsys-hetzner" \
  /Users/hollosigabor/Downloads/NewvSys/ \
  root@46.224.157.177:/root/vsys-next/
```

### 4.2 .env fajl ujraletrehozasa (KOTELEZO rsync utan!)

```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cat > /root/vsys-next/.env << 'EOF'
# Database
POSTGRES_USER=vsys
POSTGRES_PASSWORD=vsys_staging_password
POSTGRES_DB=vsys_next

# Security
JWT_SECRET=K8xPmN2vQ9wR4tY7uI0oL3jH6gF5dS8aZ1xC4vB7nM2kJ9pQ6wE3rT0yU5iO8lA1

# Email SMTP
SMTP_HOST=smtp.websupport.hu
SMTP_PORT=587
SMTP_USER=info@vemiax.com
SMTP_PASS=Vemiax2026!

# App
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
EOF"
```

### 4.3 Kontenerek ujraepitese

```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

### 4.4 Ellenorzes

```bash
# Logok megtekintese
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-api --tail 20"

# Kontenerek allapota
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker ps"
```

---

## 5. BACKUP KESZITES

### 5.1 Adatbazis dump

```bash
# Backup konyvtar letrehozasa
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/Users/hollosigabor/Downloads/NewvSys/backups/backup_${BACKUP_DATE}"
mkdir -p "$BACKUP_DIR"

# Adatbazis dump letoltese
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 \
  "cd /root/vsys-next && docker compose -f docker-compose.full.yml exec -T postgres pg_dump -U vsys vsys_next" \
  > "$BACKUP_DIR/database_dump.sql"

# Ellenorzes
head -20 "$BACKUP_DIR/database_dump.sql"
```

### 5.2 Forraskod mentese

```bash
# Forraskod masolasa backup konyvtarba
cp -r /Users/hollosigabor/Downloads/NewvSys/src "$BACKUP_DIR/"
cp -r /Users/hollosigabor/Downloads/NewvSys/pwa/src "$BACKUP_DIR/pwa_src"
cp -r /Users/hollosigabor/Downloads/NewvSys/prisma "$BACKUP_DIR/"
cp /Users/hollosigabor/Downloads/NewvSys/package.json "$BACKUP_DIR/"
cp /Users/hollosigabor/Downloads/NewvSys/docker-compose.full.yml "$BACKUP_DIR/"
```

### 5.3 Git commit hash mentese

```bash
cd /Users/hollosigabor/Downloads/NewvSys
git rev-parse HEAD > "$BACKUP_DIR/git_commit.txt"
echo "Git commit: $(cat $BACKUP_DIR/git_commit.txt)"
```

---

## 6. VISSZAALLITAS (RESTORE)

### 6.1 Kod visszaallitasa Git-bol

```bash
cd /Users/hollosigabor/Downloads/NewvSys

# Adott commit-ra visszaallas
git checkout <COMMIT_HASH>

# VAGY uj branch letrehozasa
git checkout -b restore-branch <COMMIT_HASH>

# Pelda a legutobbi backup commit-javal:
git checkout 674da0e
```

### 6.2 Adatbazis visszaallitasa

**⚠️ FIGYELEM: Ez TORLI az osszes jelenlegi adatot!**

```bash
# 1. Dump fajl feltoltese a szerverre
scp -i ~/.ssh/vsys-hetzner \
  /Users/hollosigabor/Downloads/NewvSys/backups/full_backup_20260115_platform_view/database_dump.sql \
  root@46.224.157.177:/root/

# 2. Adatbazis ujraletrehozasa es visszatoltese
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 << 'ENDSSH'
cd /root/vsys-next

# Adatbazis torles es ujraletrehozas
docker compose -f docker-compose.full.yml exec -T postgres psql -U vsys -c "DROP DATABASE IF EXISTS vsys_next;"
docker compose -f docker-compose.full.yml exec -T postgres psql -U vsys -c "CREATE DATABASE vsys_next;"

# Backup visszatoltese
cat /root/database_dump.sql | docker compose -f docker-compose.full.yml exec -T postgres psql -U vsys vsys_next

# Takaritas
rm /root/database_dump.sql
ENDSSH
```

### 6.3 Alkalmazas ujrainditasa

```bash
# Kod szinkronizalas
rsync -avz \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '.next' \
  --exclude 'backup' \
  --exclude 'backups' \
  -e "ssh -i ~/.ssh/vsys-hetzner" \
  /Users/hollosigabor/Downloads/NewvSys/ \
  root@46.224.157.177:/root/vsys-next/

# .env ujraletrehozasa
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

# Ujraepites
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

---

## 7. VESZELYHELYZETI PARANCSOK

### 7.1 Kontenerek ujrainditasa (rebuild nelkul)

```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml restart api"
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml restart pwa"
```

### 7.2 Logok megtekintese

```bash
# API logok
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-api --tail 100"

# PWA logok
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-pwa --tail 100"

# Postgres logok
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker logs vsys-postgres --tail 100"
```

### 7.3 Kontener shellbe belepes

```bash
# API kontener
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec -it vsys-api sh"

# Postgres kontener
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec -it vsys-postgres psql -U vsys vsys_next"
```

---

## 8. TILTOTT MUVELETEK

| Parancs | Miert tilos |
|---------|-------------|
| `docker compose down -v` | **TORLI AZ ADATBAZIST!** |
| `docker volume rm vsys_postgres_data` | **TORLI AZ ADATBAZIST!** |
| Jelszavak commitolasa | Biztonsagi kockazat |
| `/opt/vsys/` hasznalata | Regi, nem hasznalt konyvtar |
| `docker-compose.yml` hasznalata | Regi fajl, `docker-compose.full.yml` kell |

---

## 9. ELERHETO BACKUPOK

| Backup neve | Git commit | Datum | Leiras |
|-------------|------------|-------|--------|
| `full_backup_20260115_platform_view` | `674da0e` | 2026.01.15 | Platform View funkcio |
| `full_backup_20260115` | korabbi | 2026.01.15 | Alap backup |

---

## 10. WEBOLDALAK

| Oldal | URL |
|-------|-----|
| PWA Frontend | https://app.vemiax.com |
| API Backend | https://api.vemiax.com |
| Platform Admin | https://app.vemiax.com/platform-admin |
| Network Admin | https://app.vemiax.com/network-admin |

---

## 11. GYORS REFERENCIAK

### Teljes deployment (copy-paste)

```bash
# 1. Sync
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' --exclude 'backups' -e "ssh -i ~/.ssh/vsys-hetzner" /Users/hollosigabor/Downloads/NewvSys/ root@46.224.157.177:/root/vsys-next/

# 2. .env
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

# 3. Build
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

### Csak API ujraepites

```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml build --no-cache api && docker compose -f docker-compose.full.yml up -d api"
```

### Csak PWA ujraepites

```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml build --no-cache pwa && docker compose -f docker-compose.full.yml up -d pwa"
```
