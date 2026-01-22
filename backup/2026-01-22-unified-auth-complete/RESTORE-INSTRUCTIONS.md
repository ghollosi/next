# VSys Wash - Visszaállítási Útmutató
## Backup: 2026-01-22 Unified Auth Complete

---

## BACKUP INFORMÁCIÓK

| Adat | Érték |
|------|-------|
| **Dátum** | 2026-01-22 03:00 CET |
| **Git Commit** | ef829ae |
| **Git Tag** | backup-2026-01-22-unified-auth-complete |
| **Cél** | Teljes backup az egységes email+jelszó auth implementáció után |

---

## VÁLTOZÁSOK EBBEN A VERZIÓBAN

### Implementált funkciók:
- **Partner Portal**: email + jelszó bejelentkezés (korábban: code + PIN)
- **Operator Portal**: email + jelszó bejelentkezés (korábban: locationCode + PIN)
- **Driver/PWA**: email + jelszó bejelentkezés (korábban: phone/email + PIN)
- Jelszó visszaállítás minden portálhoz
- Legacy PIN-alapú endpointok megtartva visszafelé kompatibilitáshoz

### Módosított fájlok:
- `src/partner-portal/partner-portal.controller.ts`
- `src/operator-portal/operator-portal.controller.ts`
- `src/pwa/pwa.controller.ts`
- `pwa/src/app/partner/login/page.tsx`
- `pwa/src/app/operator-portal/login/page.tsx`
- `pwa/src/app/login/page.tsx`
- `pwa/src/lib/api.ts`
- `prisma/schema.prisma`

### Alapértelmezett jelszó minden felhasználónak:
```
Demo1234!
```

---

## VISSZAÁLLÍTÁS

### 1. Kód visszaállítása:
```bash
cd /Users/hollosigabor/Downloads/NewvSys
git checkout backup-2026-01-22-unified-auth-complete
```

### 2. Adatbázis visszaállítása:
```bash
# Feltöltés
scp -i ~/.ssh/vsys-hetzner \
  backup/2026-01-22-unified-auth-complete/database-backup.sql \
  root@46.224.157.177:/tmp/

# Visszaállítás
ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 \
  "docker exec -i vsys-postgres psql -U vsys vsys_next < /tmp/database-backup.sql"
```

### 3. Deploy:
```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' --exclude 'backup' --exclude '.env' \
  -e "ssh -i ~/.ssh/vsys-hetzner" \
  /Users/hollosigabor/Downloads/NewvSys/ \
  root@46.224.157.177:/root/vsys-next/

ssh -i ~/.ssh/vsys-hetzner root@46.224.157.177 \
  "cd /root/vsys-next && docker compose -f docker-compose.full.yml up -d --build"
```

---

## BELÉPÉSI ADATOK

### Partner Portal (app.vemiax.com/partner/login)
| Email | Jelszó |
|-------|--------|
| info@eurocargo.hu | Demo1234! |
| info@gepjarmu.hu | Demo1234! |
| office@hungarocamion.hu | Demo1234! |

### Operator Portal (app.vemiax.com/operator-portal/login)
| Email | Jelszó |
|-------|--------|
| gyor2.operator@demo.vemiax.com | Demo1234! |
| szeksz.operator@demo.vemiax.com | Demo1234! |
| boly.operator@demo.vemiax.com | Demo1234! |

### Driver/PWA (app.vemiax.com/login)
| Email | Jelszó |
|-------|--------|
| kovacs.istvan@example.com | Demo1234! |
| toth.janos@email.hu | Demo1234! |
| kiss.gabor@email.hu | Demo1234! |

### Platform Admin (változatlan)
| Email | Jelszó |
|-------|--------|
| admin@vemiax.com | (eredeti jelszó) |

### Network Admin (változatlan - slug szükséges)
| Email | Slug | Jelszó |
|-------|------|--------|
| gabhol@gmail.com | vsys-demo | (eredeti jelszó) |

---

**Készült:** 2026-01-22 03:00 CET
