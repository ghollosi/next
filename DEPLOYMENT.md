# VSys Deployment Utasítás

## KRITIKUS SZABÁLYOK - MINDIG TARTSD BE!

### 1. HELYES KÖNYVTÁR A SZERVEREN
```
/root/vsys-next
```
**NEM** `/root/NewvSys`, **NEM** `/opt/vsys/`, **NEM** `/root/vsys`!

### 2. HELYES DOCKER-COMPOSE FÁJL
```
docker-compose.full.yml
```
**NEM** `docker-compose.yml`!

### 3. SOHA NE HASZNÁLD EZEKET
```bash
docker compose down -v        # A -v TÖRLI AZ ADATBÁZIST!
docker volume rm              # TÖRLI AZ ADATOKAT!
docker system prune -a        # TÖRÖLHET FONTOS DOLGOKAT!
```

---

## DEPLOYMENT LÉPÉSEK

### 1. Fájlok szinkronizálása lokálról a szerverre
```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' --exclude 'backups' \
  -e "ssh" \
  /Users/hollosigabor/Downloads/NewvSys/ \
  root@46.224.157.177:/root/vsys-next/
```

### 2. Konténerek újraépítése és indítása
```bash
ssh root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

### 3. Ellenőrzés
```bash
ssh root@46.224.157.177 "docker ps && curl -s localhost:3000/health"
```

---

## CSAK ÚJRAINDÍTÁS (kód változás nélkül)

### API újraindítása
```bash
ssh root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml restart api"
```

### PWA újraindítása
```bash
ssh root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml restart pwa"
```

### Minden újraindítása (adatbázis is)
```bash
ssh root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml restart"
```

---

## PRISMA MIGRÁCIÓ FUTTATÁSA

Ha új adatbázis tábla/oszlop került a schema-ba:
```bash
ssh root@46.224.157.177 "cd /root/vsys-next && docker exec vsys-api npx prisma migrate deploy"
```

---

## LOGOK MEGTEKINTÉSE

### API logok
```bash
ssh root@46.224.157.177 "docker logs vsys-api --tail 100"
```

### PWA logok
```bash
ssh root@46.224.157.177 "docker logs vsys-pwa --tail 100"
```

### Valós idejű logok követése
```bash
ssh root@46.224.157.177 "docker logs -f vsys-api"
```

---

## ADATBÁZIS MŰVELETEK

### Adatbázis backup készítése
```bash
ssh root@46.224.157.177 "docker exec vsys-postgres pg_dump -U vsys vsys_next > /root/backups/vsys_backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Adatbázis konzol
```bash
ssh root@46.224.157.177 "docker exec -it vsys-postgres psql -U vsys -d vsys_next"
```

---

## HIBAELHÁRÍTÁS

### Ha "container name already in use" hiba jön
```bash
ssh root@46.224.157.177 "docker rm -f vsys-pwa vsys-api 2>/dev/null; cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d"
```
**FONTOS:** A `vsys-postgres` konténert NE töröld, mert az tartalmazza az adatbázist!

### Ha a konténerek nem indulnak
```bash
ssh root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml logs"
```

### Konténer státusz ellenőrzése
```bash
ssh root@46.224.157.177 "docker ps -a"
```

---

## SZERVER ADATOK

- **Szerver IP:** 46.224.157.177
- **SSH:** root@46.224.157.177
- **API URL:** https://vsys.app (port 3000 belül)
- **PWA URL:** https://vsys.app (port 3001 belül)
- **Adatbázis:** PostgreSQL, vsys user, vsys_next database

---

## ELLENŐRZŐ LISTA DEPLOY ELŐTT

- [ ] Lokálisan buildel a projekt? (`cd pwa && npm run build`)
- [ ] Nincsenek TypeScript hibák?
- [ ] A helyes könyvtárba deployolok? (`/root/vsys-next`)
- [ ] A helyes docker-compose fájlt használom? (`docker-compose.full.yml`)
- [ ] Készítettem backup-ot fontos változtatás előtt?

---

## GYORS EGYSOROS DEPLOY

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' --exclude 'backups' -e "ssh" /Users/hollosigabor/Downloads/NewvSys/ root@46.224.157.177:/root/vsys-next/ && ssh root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

---

## BACKUP ÉS VISSZAÁLLÍTÁS (ROLLBACK)

### Backup helyek

| Backup típus | Hely | Dátum |
|-------------|------|-------|
| Lokális kódbázis | `/Users/hollosigabor/Downloads/backups/NewvSys_backup_20260115_155245` | 2026-01-15 |
| Adatbázis (szerveren) | `/root/backups/vsys_next_backup_20260115_155413.sql` | 2026-01-15 |
| Git commit | `1a568de` | 2026-01-15 - PIN reset feature előtt: `19f1eb1` |

### Visszaállítás előző verzióra

#### 1. Git visszaállítás (kód)
Ha csak a kódot kell visszaállítani egy korábbi commitra:
```bash
# Lokálisan
cd /Users/hollosigabor/Downloads/NewvSys
git checkout 19f1eb1  # PIN reset előtti verzió

# Vagy hard reset (óvatosan!)
git reset --hard 19f1eb1
```

#### 2. Kódbázis visszaállítás backupból
Ha a lokális repo megsérült:
```bash
# Töröld a jelenlegi verziót és másold vissza a backupot
rm -rf /Users/hollosigabor/Downloads/NewvSys
cp -r /Users/hollosigabor/Downloads/backups/NewvSys_backup_20260115_155245 /Users/hollosigabor/Downloads/NewvSys
```

#### 3. Adatbázis visszaállítás (VIGYÁZAT!)
Ez törli az összes jelenlegi adatot és visszaállítja a backup állapotát:
```bash
# 1. Ellenőrizd, hogy létezik-e a backup
ssh root@46.224.157.177 "ls -la /root/backups/vsys_next_backup_20260115_155413.sql"

# 2. Töröld és újra hozd létre az adatbázist
ssh root@46.224.157.177 "docker exec vsys-postgres psql -U vsys -c 'DROP DATABASE vsys_next;'"
ssh root@46.224.157.177 "docker exec vsys-postgres psql -U vsys -c 'CREATE DATABASE vsys_next;'"

# 3. Állítsd vissza a backupból
ssh root@46.224.157.177 "cat /root/backups/vsys_next_backup_20260115_155413.sql | docker exec -i vsys-postgres psql -U vsys vsys_next"
```

#### 4. Teljes rendszer visszaállítás
Ha minden visszaállítása szükséges (kód + adatbázis):
```bash
# 1. Kód visszaállítása lokálisan
cd /Users/hollosigabor/Downloads/NewvSys
git reset --hard 19f1eb1

# 2. Kód szinkronizálása a szerverre
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' --exclude 'backups' \
  -e "ssh" \
  /Users/hollosigabor/Downloads/NewvSys/ \
  root@46.224.157.177:/root/vsys-next/

# 3. Adatbázis visszaállítása
ssh root@46.224.157.177 "docker exec vsys-postgres psql -U vsys -c 'DROP DATABASE vsys_next;'"
ssh root@46.224.157.177 "docker exec vsys-postgres psql -U vsys -c 'CREATE DATABASE vsys_next;'"
ssh root@46.224.157.177 "cat /root/backups/vsys_next_backup_20260115_155413.sql | docker exec -i vsys-postgres psql -U vsys vsys_next"

# 4. Konténerek újraépítése
ssh root@46.224.157.177 "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

### Backup készítés (újabb mentéshez)
```bash
# Lokális kódbázis backup
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
cp -r /Users/hollosigabor/Downloads/NewvSys /Users/hollosigabor/Downloads/backups/NewvSys_backup_$BACKUP_DATE

# Adatbázis backup (szerveren)
ssh root@46.224.157.177 "docker exec vsys-postgres pg_dump -U vsys vsys_next > /root/backups/vsys_next_backup_\$(date +%Y%m%d_%H%M%S).sql"
```

---

**Utolsó frissítés:** 2026-01-15
