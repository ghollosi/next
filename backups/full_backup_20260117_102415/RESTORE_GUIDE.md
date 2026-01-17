# VSys Next - Teljes Visszaallitasi Utmutato
## Backup: 2026-01-17 10:24:15

Ez a backup tartalmazza:
- Adatbazis dump (PostgreSQL custom format)
- Teljes forráskód (node_modules és build nélkül)
- Környezeti változók (.env)

---

## Backup tartalma

| Fájl | Leírás | Méret |
|------|--------|-------|
| `vsys_next_20260117_102415.dump` | PostgreSQL adatbázis dump | ~213KB |
| `vsys-next-code.tar.gz` | Forráskód archívum | ~16MB |
| `env_backup.txt` | .env fájl másolat | ~485B |

---

## 1. TELJES VISSZAALLITAS (Adatbazis + Kod)

### 1.1 Kapcsolodas a szerverhez
```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177
```

### 1.2 Szolgaltatasok leallitasa
```bash
cd /root/vsys-next
docker compose -f docker-compose.full.yml down
```

### 1.3 Adatbazis visszaallitasa
```bash
# Postgres container inditasa
docker compose -f docker-compose.full.yml up -d postgres
sleep 10

# Meglevo adatbazis torlese es ujra letrehozasa
docker exec vsys-postgres psql -U vsys -c "DROP DATABASE IF EXISTS vsys_next_old;"
docker exec vsys-postgres psql -U vsys -c "ALTER DATABASE vsys_next RENAME TO vsys_next_old;"
docker exec vsys-postgres psql -U vsys -c "CREATE DATABASE vsys_next OWNER vsys;"

# Backup visszaallitasa
docker cp /root/backups/vsys_20260117_102415/vsys_next_20260117_102415.dump vsys-postgres:/tmp/
docker exec vsys-postgres pg_restore -U vsys -d vsys_next -c /tmp/vsys_next_20260117_102415.dump

# Sikeres visszaallitas utan a regi DB torolheto
docker exec vsys-postgres psql -U vsys -c "DROP DATABASE vsys_next_old;"
```

### 1.4 Kod visszaallitasa (OPCIONALIS - csak ha a kod is sérült)
```bash
cd /root
mv vsys-next vsys-next-broken  # Regi kod elmentese
mkdir vsys-next
cd vsys-next
tar -xzf /root/backups/vsys_20260117_102415/vsys-next-code.tar.gz --strip-components=1
cp /root/backups/vsys_20260117_102415/env_backup.txt .env
```

### 1.5 Szolgaltatasok ujrainditasa
```bash
cd /root/vsys-next
docker compose -f docker-compose.full.yml up -d --build
```

### 1.6 Ellenorzes
```bash
docker ps  # Minden container "healthy" legyen
curl http://localhost:3000/health
curl -o /dev/null -w '%{http_code}' http://localhost:3001/
```

---

## 2. CSAK ADATBAZIS VISSZAALLITAS

Ha csak az adatbazist kell visszaallitani (a kod jo):

```bash
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177

# Szolgaltatasok leallitasa
cd /root/vsys-next
docker compose -f docker-compose.full.yml stop api pwa

# Adatbazis visszaallitas
docker cp /root/backups/vsys_20260117_102415/vsys_next_20260117_102415.dump vsys-postgres:/tmp/
docker exec vsys-postgres pg_restore -U vsys -d vsys_next -c /tmp/vsys_next_20260117_102415.dump

# Szolgaltatasok ujrainditasa
docker compose -f docker-compose.full.yml up -d
```

---

## 3. VISSZAALLITAS LOKALIS GEPROL

Ha a szerver backupok elvesztek, a lokalis geprol:

```bash
# Backup feltoltese a szerverre
scp -i ~/.ssh/vsys-hetzner /Users/hollosigabor/Downloads/NewvSys/backups/full_backup_20260117_102415/* root@46.224.157.177:/root/backups/vsys_20260117_102415/

# Majd kovesse az 1. pontot
```

---

## 4. GIT VISSZAALLITAS

Ha csak a kodot kell visszaallitani egy adott commit-ra:

```bash
# Lokalis gepen
cd /Users/hollosigabor/Downloads/NewvSys
git log --oneline  # Keresse meg a commit hash-t
git checkout <commit-hash>

# Vagy a stabil verzio (ez a backup):
git checkout 7ef65d0  # Independent Customer & Location Visibility commit

# Deploy ujra
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' --exclude 'backups' -e "ssh -i ~/.ssh/vsys-hetzner" /Users/hollosigabor/Downloads/NewvSys/ root@46.224.157.177:/root/vsys-next/

ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

---

## 5. HIBAKEREZES

### Adatbazis kapcsolat hiba
```bash
# Jelszo beallitasa
docker exec vsys-postgres psql -U vsys -d vsys_next -c "ALTER USER vsys WITH PASSWORD 'vsys_dev_password';"
docker restart vsys-api
```

### Container nem indul
```bash
docker logs vsys-api --tail 100
docker logs vsys-pwa --tail 100
docker logs vsys-postgres --tail 100
```

### Migration hiba
```bash
# Manualisan futtassa a migraciot
docker exec vsys-api npx prisma migrate deploy
```

---

## Fontos fajlok es utvonalak

| Hely | Leiras |
|------|--------|
| `/root/vsys-next/` | Forráskód a szerveren |
| `/root/backups/` | Backupok a szerveren |
| `/Users/hollosigabor/Downloads/NewvSys/` | Forráskód lokálisan |
| `/Users/hollosigabor/Downloads/NewvSys/backups/` | Backupok lokálisan |

---

## Backup informacio

- **Datum:** 2026-01-17 10:24:15
- **Git commit:** 7ef65d0 (feat: Independent Customer & Location Visibility)
- **Feature:** Privat ugyfel regisztracio + Location visibility
- **Szerver:** 46.224.157.177 (Hetzner)
- **Alkalmazas URL:** https://app.vemiax.com
