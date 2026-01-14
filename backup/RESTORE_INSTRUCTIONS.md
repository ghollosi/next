# vSys Backup - v1.1.0-booking-email

**Backup Date:** 2026-01-13
**Git Tag:** v1.1.0-booking-email
**Git Commit:** e58e381

## Backup Contents

1. **Database Backup:** `db_backup_20260113_v2.sql` (4252 rows, ~374KB)
2. **Git Tag:** `v1.1.0-booking-email` (pushed to GitHub)
3. **Previous Backup:** `v1.0.0-booking-complete` still available

## What This Version Contains

- **Booking System Fixes:**
  - Fixed slots API response format (returns `{ slots, services }`)
  - Fixed VehicleType enum values (SEMI_TRUCK instead of TRUCK)
  - Fixed servicePackageId field name in requests
  - Default vehicle type changed to CAR

- **Email Confirmation:**
  - Automatic confirmation email on every booking
  - Beautiful HTML email template with all booking details
  - Network-specific email provider support (SMTP/Resend)

## Restore Procedures

### 1. Code Restore (Git)

```bash
# Navigate to repo
cd /Users/hollosigabor/Downloads/NewvSys

# Restore to this exact version
git fetch --tags
git checkout v1.1.0-booking-email

# Or reset current branch to this tag
git reset --hard v1.1.0-booking-email
```

### 2. Database Restore (Server)

```bash
# Copy backup to server
scp /Users/hollosigabor/Downloads/NewvSys/backup/db_backup_20260113_v2.sql root@46.224.157.177:/tmp/

# SSH to server
ssh root@46.224.157.177

# Stop the backend service
cd /opt/vsys
docker compose stop app

# Restore database
docker exec -i vsys-postgres psql -U vsys -d vsys_next < /tmp/db_backup_20260113_v2.sql

# For clean restore (drop and recreate):
docker exec vsys-postgres psql -U vsys -c "DROP DATABASE vsys_next;"
docker exec vsys-postgres psql -U vsys -c "CREATE DATABASE vsys_next;"
docker exec -i vsys-postgres psql -U vsys -d vsys_next < /tmp/db_backup_20260113_v2.sql

# Restart services
docker compose up -d
```

### 3. Full Redeploy from Backup

```bash
# 1. On local machine - checkout the tagged version
cd /Users/hollosigabor/Downloads/NewvSys
git checkout v1.1.0-booking-email

# 2. Build locally
npm run build
cd pwa && npm run build && cd ..

# 3. Copy to server
rsync -avz --exclude='node_modules' --exclude='.git' \
  /Users/hollosigabor/Downloads/NewvSys/ \
  root@46.224.157.177:/opt/vsys/

# 4. On server - rebuild and restart
ssh root@46.224.157.177
cd /opt/vsys
docker compose build app pwa --no-cache
docker compose up -d
```

## Available Backup Points

| Tag | Date | Description |
|-----|------|-------------|
| v1.1.0-booking-email | 2026-01-13 | Booking with email confirmation |
| v1.0.0-booking-complete | 2026-01-13 | Initial booking system |

## Server Information

- **Server IP:** 46.224.157.177
- **Database:** PostgreSQL (Docker: vsys-postgres)
- **Database Name:** vsys_next
- **Database User:** vsys
- **Backend Port:** 3000
- **PWA Port:** 3001

## Verification After Restore

```bash
# Check backend health
curl http://46.224.157.177:3000/health

# Test login
curl -X POST http://46.224.157.177:3000/platform-admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vsys.hu","password":"admin123"}'

# Test booking slots (requires valid session)
curl "http://46.224.157.177:3000/pwa/bookings/slots?locationId=<ID>&date=2026-01-22&vehicleType=CAR" \
  -H "x-driver-session: <SESSION>"
```
