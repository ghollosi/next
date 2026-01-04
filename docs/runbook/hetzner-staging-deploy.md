# Hetzner Cloud Staging Deployment Runbook

## VSys Next - Module 1: Core Wash Registration & Ledger

**Verzió**: v0.1.0-module-core
**Környezet**: Staging
**Utolsó frissítés**: 2026-01-04

---

## Szerver Adatok

| Elem | Érték |
|------|-------|
| **Szolgáltató** | Hetzner Cloud |
| **Szerver név** | vsys-staging-01 |
| **IP cím** | 46.224.157.177 |
| **OS** | Ubuntu 22.04 LTS |
| **Típus** | CX22 (2 vCPU, 4GB RAM) |
| **Lokáció** | Falkenstein (fsn1) |
| **Havi költség** | ~€4.35 |

---

## Elérési Pontok

| Szolgáltatás | URL |
|--------------|-----|
| **Health Check** | http://46.224.157.177:3000/health |
| **Swagger Docs** | http://46.224.157.177:3000/api/docs |
| **PWA API** | http://46.224.157.177:3000/pwa/* |
| **Operator API** | http://46.224.157.177:3000/operator/* |

---

## SSH Hozzáférés

### Előfeltétel
SSH kulcs: `~/.ssh/vsys-hetzner`

### Bejelentkezés

```bash
# Deploy felhasználóként (ajánlott)
ssh -i ~/.ssh/vsys-hetzner deploy@46.224.157.177

# Root felhasználóként (csak ha szükséges)
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177
```

---

## Alkalmazás Kezelése

### Státusz Ellenőrzése

```bash
cd /opt/vsys
docker compose -f docker-compose.local-staging.yml ps
```

### Logok Megtekintése

```bash
cd /opt/vsys

# Összes szolgáltatás
docker compose -f docker-compose.local-staging.yml logs -f

# Csak alkalmazás
docker compose -f docker-compose.local-staging.yml logs -f app

# Csak adatbázis
docker compose -f docker-compose.local-staging.yml logs -f postgres
```

### Újraindítás

```bash
cd /opt/vsys
docker compose -f docker-compose.local-staging.yml restart
```

### Leállítás

```bash
cd /opt/vsys
docker compose -f docker-compose.local-staging.yml down
```

### Indítás

```bash
cd /opt/vsys
docker compose -f docker-compose.local-staging.yml -f docker-compose.secure.override.yml up -d
```

---

## Verzió Frissítés

### Új Tag Telepítése

```bash
ssh -i ~/.ssh/vsys-hetzner deploy@46.224.157.177

cd /opt/vsys
docker compose -f docker-compose.local-staging.yml down
git fetch --all --tags
git checkout tags/NEW_TAG_HERE
docker compose -f docker-compose.local-staging.yml -f docker-compose.secure.override.yml up -d --build

# Ellenőrzés
curl http://localhost:3000/health
```

---

## Adatbázis Hozzáférés

Az adatbázis **NEM** érhető el kívülről (biztonság).

### Adatbázis Shell

```bash
cd /opt/vsys
docker compose -f docker-compose.local-staging.yml exec postgres psql -U vsys -d vsys_next_staging
```

### Gyakori SQL Parancsok

```sql
-- Táblák listázása
\dt

-- Kilépés
\q
```

---

## Hibaelhárítás

### Konténer Nem Indul

```bash
cd /opt/vsys
docker compose -f docker-compose.local-staging.yml logs app
```

### Health Check Sikertelen

1. Várj 60 másodpercet az indítás után
2. Ellenőrizd a logokat:
   ```bash
   docker compose -f docker-compose.local-staging.yml logs app --tail 50
   ```

### Nem Érhető El Kívülről

1. Ellenőrizd a tűzfalat:
   ```bash
   sudo ufw status
   ```

2. Ellenőrizd a port kötést:
   ```bash
   docker compose -f docker-compose.local-staging.yml ps
   # A PORTS oszlopban 0.0.0.0:3000 kell legyen
   ```

---

## Rollback

### Előző Verzióra Visszaállás

```bash
cd /opt/vsys
docker compose -f docker-compose.local-staging.yml down
git checkout tags/PREVIOUS_TAG
docker compose -f docker-compose.local-staging.yml -f docker-compose.secure.override.yml up -d --build
```

### Teljes Reset (Adatok Törlésével)

**FIGYELEM: Ez törli az összes adatbázis adatot!**

```bash
cd /opt/vsys
docker compose -f docker-compose.local-staging.yml down -v
docker compose -f docker-compose.local-staging.yml -f docker-compose.secure.override.yml up -d --build
```

---

## Szerver Törlése

**FIGYELEM: Ez visszafordíthatatlan!**

1. Hetzner Console → Servers
2. Kattints: `vsys-staging-01`
3. Jobb felső sarok → **Delete**
4. Írd be a szerver nevét megerősítéshez
5. Kattints: **Delete server**

---

## Biztonság

| Port | Szolgáltatás | Státusz |
|------|--------------|---------|
| 22 | SSH | ✅ Nyitva (csak kulccsal) |
| 3000 | API | ✅ Nyitva |
| 5432 | PostgreSQL | ❌ Zárt |
| Többi | - | ❌ Zárt (UFW) |

---

## Fájl Struktúra a Szerveren

```
/opt/vsys/
├── docker-compose.local-staging.yml
├── docker-compose.secure.override.yml
├── .env
├── Dockerfile
├── prisma/
├── src/
└── ...
```

---

## Kapcsolódó Dokumentáció

- [Module 1 Specifikáció](../spec/module-1-core-wash-ledger.md)
- [API Dokumentáció](http://46.224.157.177:3000/api/docs)

---

## Verzió Történet

| Dátum | Verzió | Megjegyzés |
|-------|--------|------------|
| 2026-01-04 | v0.1.0-module-core | Első staging telepítés |
