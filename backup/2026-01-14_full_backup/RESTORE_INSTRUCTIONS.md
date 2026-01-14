# VSys Full Backup - 2026-01-14

## Backup tartalma

- `database_dump.sql` - Teljes PostgreSQL adatbázis dump
- `server_env.txt` - Szerver .env fájl
- `docker-compose.full.yml` - Docker compose konfiguráció

## Git commit

Ez a backup a következő commithoz tartozik:
```
git checkout [COMMIT_HASH]
```

## Visszaállítás menete

### 1. Kód visszaállítása

```bash
# A commit-ra visszaállás
git checkout [COMMIT_HASH]

# VAGY ha új branch-re akarod
git checkout -b restore-2026-01-14 [COMMIT_HASH]
```

### 2. Adatbázis visszaállítása

```bash
# Szerveren
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177

# Adatbázis törlése és újra létrehozása
docker exec vsys-postgres psql -U vsys -c "DROP DATABASE vsys_next;"
docker exec vsys-postgres psql -U vsys -c "CREATE DATABASE vsys_next;"

# Dump visszatöltése (lokálról)
cat backup/2026-01-14_full_backup/database_dump.sql | ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "docker exec -i vsys-postgres psql -U vsys vsys_next"
```

### 3. Szerver konfiguráció visszaállítása

```bash
# .env fájl
scp -i ~/.ssh/vsys-hetzner backup/2026-01-14_full_backup/server_env.txt root@46.224.157.177:/root/vsys-next/.env

# docker-compose
scp -i ~/.ssh/vsys-hetzner backup/2026-01-14_full_backup/docker-compose.full.yml root@46.224.157.177:/root/vsys-next/docker-compose.full.yml
```

### 4. Kód szinkronizálása és újraindítás

```bash
# Kód feltöltése
rsync -avz --delete -e "ssh -i ~/.ssh/vsys-hetzner" \
  --exclude 'node_modules' --exclude 'dist' --exclude '.env' --exclude 'backup' \
  /Users/hollosigabor/Downloads/NewvSys/ \
  root@46.224.157.177:/root/vsys-next/

# PWA szinkronizálás
rsync -avz --delete -e "ssh -i ~/.ssh/vsys-hetzner" \
  --exclude 'node_modules' --exclude '.next' --exclude 'dist' --exclude '.env' \
  /Users/hollosigabor/Downloads/NewvSys/pwa/ \
  root@46.224.157.177:/root/vsys-next/pwa/

# Rebuild és restart
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml down && docker compose -f docker-compose.full.yml up -d --build"
```

## Működő belépési adatok (ezen a ponton)

### Platform Admin
- URL: https://app.vemiax.com/platform-admin
- Email: admin@vsys.hu
- Jelszó: AdminPass123

### Network Admin (vsys-demo)
- URL: https://app.vemiax.com/network-admin
- Slug: vsys-demo
- Email: gabhol@gmail.com
- Jelszó: AdminPass123

### Operátor
- URL: https://app.vemiax.com/operator-portal
- Location kód: SZEKSZ
- PIN: 1234

### Partner
- URL: https://app.vemiax.com/partner
- Partner kód: EURO01
- PIN: 1234

### Sofőr
- URL: https://app.vemiax.com/login
- Telefon: +36301234561
- PIN: 1234

## Hálózatok

1. vSys Demo Network (vsys-demo)
2. Kata Mosó (kata-moso)
3. Kata Wash (kata-wash)
