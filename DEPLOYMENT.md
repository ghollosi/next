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

**Utolsó frissítés:** 2026-01-15
