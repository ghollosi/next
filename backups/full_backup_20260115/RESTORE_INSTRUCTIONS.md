# VSys Next - Visszaállítási Útmutató

## Backup információk

- **Dátum:** 2026-01-15
- **Git commit:** 53756a7
- **Git tag:** v1.0.0-beta
- **Állapot:** Működő MVP demo-ready állapot

## Backup helyek

### 1. Lokális backup
```
/Users/hollosigabor/Downloads/NewvSys/backups/full_backup_20260115/
├── src/                    # Backend forráskód
├── pwa/                    # Frontend forráskód
├── prisma/                 # Adatbázis séma és migrációk
├── package.json            # Függőségek
├── docker-compose.full.yml # Docker konfiguráció
└── vsys_next_20260115_202142.sql  # Adatbázis dump
```

### 2. Szerveren
```
root@46.224.157.177:/root/backups/vsys_next_20260115_202142.sql
```

### 3. GitHub
```
Repository: https://github.com/ghollosi/next.git
Branch: master
Commit: 53756a7
Tag: v1.0.0-beta
```

---

## Visszaállítási módok

### A) Git-ből visszaállítás (ajánlott, ha csak kód változott)

```bash
# Lokálisan
cd /Users/hollosigabor/Downloads/NewvSys
git fetch origin
git checkout v1.0.0-beta

# VAGY konkrét commit-ra
git checkout 53756a7

# Szerverre deploy
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' --exclude 'backups' -e "ssh" /Users/hollosigabor/Downloads/NewvSys/ root@46.224.157.177:/root/vsys-next/

# Újraépítés
ssh root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

### B) Teljes visszaállítás backup-ból (kód + adatbázis)

#### 1. Kód visszaállítása
```bash
# Lokális backup-ból
cp -r /Users/hollosigabor/Downloads/NewvSys/backups/full_backup_20260115/src/* /Users/hollosigabor/Downloads/NewvSys/src/
cp -r /Users/hollosigabor/Downloads/NewvSys/backups/full_backup_20260115/pwa/* /Users/hollosigabor/Downloads/NewvSys/pwa/
cp -r /Users/hollosigabor/Downloads/NewvSys/backups/full_backup_20260115/prisma/* /Users/hollosigabor/Downloads/NewvSys/prisma/

# Szerverre szinkronizálás
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' --exclude 'backups' -e "ssh" /Users/hollosigabor/Downloads/NewvSys/ root@46.224.157.177:/root/vsys-next/
```

#### 2. Adatbázis visszaállítása
```bash
# Szerveren
ssh root@46.224.157.177

# Backup másolása a szerverre (ha lokálisból)
scp /Users/hollosigabor/Downloads/NewvSys/backups/full_backup_20260115/vsys_next_20260115_202142.sql root@46.224.157.177:/root/backups/

# Adatbázis visszaállítása
cd /root/vsys-next
docker compose -f docker-compose.full.yml exec -T postgres psql -U vsys -d vsys_next < /root/backups/vsys_next_20260115_202142.sql
```

#### 3. Szolgáltatások újraindítása
```bash
ssh root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

---

## Ellenőrzés visszaállítás után

1. **API ellenőrzése:**
   ```bash
   curl https://api.vemiax.com/health
   ```

2. **PWA ellenőrzése:**
   - Nyisd meg: https://app.vemiax.com
   - Jelentkezz be Network Admin-ként

3. **Adatbázis ellenőrzése:**
   ```bash
   ssh root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml exec -T postgres psql -U vsys -d vsys_next -c 'SELECT COUNT(*) FROM networks;'"
   ```

---

## FONTOS figyelmeztetések

- **SOHA ne használd:** `docker compose down -v` - ez törli az adatbázist!
- A `.env` fájl NEM része a backup-nak - azt külön kell kezelni
- JWT_SECRET változás esetén minden felhasználónak újra be kell jelentkeznie

---

## Kapcsolódó információk

- **Szerver:** 46.224.157.177 (Hetzner)
- **Domének:** api.vemiax.com, app.vemiax.com
- **Adatbázis:** PostgreSQL (vsys_next)
- **Docker services:** api, pwa, postgres
