# Windows Staging Runtime Runbook

## Overview

This runbook provides step-by-step instructions for deploying and running VSys Next Module 1 on a **Windows staging server**. This machine is a **runtime host only** - no development work is performed here.

- **Target Machine**: Windows 10/11 with Docker Desktop (WSL2)
- **Fixed IP**: 192.168.2.34
- **Role**: Staging runtime environment
- **Version**: v0.1.0-module-core

---

## Services Overview

The staging environment runs the following services:

| Service | Description | Exposed Port | Internal Only |
|---------|-------------|--------------|---------------|
| **API** | NestJS application (REST API + Swagger) | 3000 or 18080 | No |
| **PostgreSQL** | Database server | - | Yes (Docker network only) |

**Security Note**: PostgreSQL is **NOT exposed** to the network. It is only accessible by the app container within the Docker network.

**Note**: There is no separate Web UI - the API service includes Swagger documentation at `/api/docs`.

---

## Port Configuration

| Deployment Mode | API Port | PostgreSQL | Override File |
|-----------------|----------|------------|---------------|
| **Standard (Secure)** | 3000 | Internal only | `docker-compose.secure.override.yml` |
| **Fallback (Secure)** | 18080 | Internal only | `docker-compose.ports.override.yml` |

**IMPORTANT**: Always use an override file to ensure PostgreSQL is not exposed to the network.

---

## Prerequisites

Before starting, ensure the Windows machine has:

1. **Docker Desktop** installed and running with WSL2 backend
2. **Git for Windows** installed
3. **PowerShell** (built-in)
4. **Network access** to GitHub (for cloning)

### Verify Docker Desktop

Open PowerShell and run:

```powershell
docker --version
docker compose version
```

Expected output (versions may vary):
```
Docker version 24.x.x, build xxxxxxx
Docker Compose version v2.x.x
```

---

## Pre-Flight Port Check

**IMPORTANT**: Before starting the system, check if the API port is available.

Open PowerShell and run:

```powershell
Write-Host "=== VSys Port Pre-Flight Check ===" -ForegroundColor Yellow

# Check port 3000 (API - Standard)
$port3000 = netstat -ano | findstr ":3000 "
if ($port3000) {
    Write-Host "WARNING: Port 3000 is IN USE" -ForegroundColor Red
    Write-Host $port3000
    Write-Host ""
    Write-Host "ACTION: Use fallback port 18080 (see Step 5b)" -ForegroundColor Yellow
} else {
    Write-Host "OK: Port 3000 is available" -ForegroundColor Green
    Write-Host ""
    Write-Host "ACTION: Use standard port 3000 (see Step 5a)" -ForegroundColor Green
}
```

Or run a simple check:

```powershell
netstat -ano | findstr :3000
```

**Decision Matrix:**

| Port 3000 | Action |
|-----------|--------|
| Available | Use **Step 5a** (Standard Port: 3000) |
| In Use | Use **Step 5b** (Fallback Port: 18080) |

---

## Step 1: Clone the Repository

Open PowerShell as Administrator and navigate to your preferred directory:

```powershell
# Navigate to a suitable location (example: C:\Apps)
cd C:\
New-Item -ItemType Directory -Name Apps -Force
cd C:\Apps

# Clone the repository
git clone https://github.com/ghollosi/next.git vsys-next

# Navigate into the project
cd vsys-next
```

---

## Step 2: Checkout the Tagged Release

Checkout the specific Module 1 release tag:

```powershell
# Fetch all tags
git fetch --all --tags

# Checkout the Module 1 release tag
git checkout tags/v0.1.0-module-core

# Verify you are on the correct tag
git describe --tags
```

Expected output:
```
v0.1.0-module-core
```

---

## Step 3: Create Environment File

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

**Note**: For local staging, no changes to `.env` are required. All configuration is provided in the docker-compose files.

---

## Step 4: Configure Windows Firewall

Configure firewall rules for the API ports only. **Do NOT open database ports.**

```powershell
# Run PowerShell as Administrator

# Standard API port
New-NetFirewallRule -DisplayName "VSys API (3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow

# Fallback API port
New-NetFirewallRule -DisplayName "VSys API Fallback (18080)" -Direction Inbound -Protocol TCP -LocalPort 18080 -Action Allow
```

To verify firewall rules:

```powershell
Get-NetFirewallRule -DisplayName "VSys*" | Format-Table DisplayName, Enabled, Direction
```

**Security Note**: No firewall rules are created for PostgreSQL (5432) - the database is only accessible within the Docker network.

---

## Step 5a: Start System (Standard Port: 3000)

**Use this if port 3000 is AVAILABLE.**

```powershell
# Navigate to project directory
cd C:\Apps\vsys-next

# Build and start containers (secure - PostgreSQL not exposed)
docker compose -f docker-compose.local-staging.yml -f docker-compose.secure.override.yml up -d --build
```

**Access URLs (Standard Port 3000):**

| Service | Local URL | LAN URL |
|---------|-----------|---------|
| Health Check | http://localhost:3000/health | http://192.168.2.34:3000/health |
| Swagger Docs | http://localhost:3000/api/docs | http://192.168.2.34:3000/api/docs |
| PWA API | http://localhost:3000/pwa/* | http://192.168.2.34:3000/pwa/* |
| Operator API | http://localhost:3000/operator/* | http://192.168.2.34:3000/operator/* |

---

## Step 5b: Start System (Fallback Port: 18080)

**Use this if port 3000 is IN USE.**

```powershell
# Navigate to project directory
cd C:\Apps\vsys-next

# Build and start containers with fallback port (secure - PostgreSQL not exposed)
docker compose -f docker-compose.local-staging.yml -f docker-compose.ports.override.yml up -d --build
```

**Access URLs (Fallback Port 18080):**

| Service | Local URL | LAN URL |
|---------|-----------|---------|
| Health Check | http://localhost:18080/health | http://192.168.2.34:18080/health |
| Swagger Docs | http://localhost:18080/api/docs | http://192.168.2.34:18080/api/docs |
| PWA API | http://localhost:18080/pwa/* | http://192.168.2.34:18080/pwa/* |
| Operator API | http://localhost:18080/operator/* | http://192.168.2.34:18080/operator/* |

---

## Step 6: Verify Container Status

Check that containers are running and healthy:

```powershell
docker compose -f docker-compose.local-staging.yml ps
```

Expected output (standard port):
```
NAME                    STATUS                   PORTS
vsys-app-staging        Up (healthy)             0.0.0.0:3000->3000/tcp
vsys-postgres-staging   Up (healthy)
```

Or with fallback port:
```
NAME                    STATUS                   PORTS
vsys-app-staging        Up (healthy)             0.0.0.0:18080->3000/tcp
vsys-postgres-staging   Up (healthy)
```

**Note**: PostgreSQL shows no port mapping - this is correct and expected for security.

**Wait for both containers to show `Up (healthy)` status.** This may take 30-60 seconds on first startup.

---

## Step 7: Verify Database Migrations

Migrations run automatically on container startup. To verify:

```powershell
docker compose -f docker-compose.local-staging.yml logs app | Select-String -Pattern "migration"
```

Expected output:
```
All migrations have been successfully applied.
```

### Manual Migration (if needed)

```powershell
docker compose -f docker-compose.local-staging.yml exec app npx prisma migrate deploy
```

---

## Step 8: Verify System Health

### Standard Port (3000)

```powershell
Invoke-RestMethod -Uri http://localhost:3000/health
```

### Fallback Port (18080)

```powershell
Invoke-RestMethod -Uri http://localhost:18080/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "module": "core-wash-ledger",
  "database": "connected"
}
```

---

## LAN Access

Once the system is running, it is accessible from other computers on the LAN (192.168.2.x network).

### Standard Port (from LAN)

| Service | URL |
|---------|-----|
| Health Check | http://192.168.2.34:3000/health |
| Swagger Docs | http://192.168.2.34:3000/api/docs |
| PWA API | http://192.168.2.34:3000/pwa/* |
| Operator API | http://192.168.2.34:3000/operator/* |

### Fallback Port (from LAN)

| Service | URL |
|---------|-----|
| Health Check | http://192.168.2.34:18080/health |
| Swagger Docs | http://192.168.2.34:18080/api/docs |
| PWA API | http://192.168.2.34:18080/pwa/* |
| Operator API | http://192.168.2.34:18080/operator/* |

### Test from Another Computer

**Linux/macOS:**
```bash
curl http://192.168.2.34:3000/health
# or fallback:
curl http://192.168.2.34:18080/health
```

**Windows PowerShell:**
```powershell
Invoke-RestMethod -Uri http://192.168.2.34:3000/health
# or fallback:
Invoke-RestMethod -Uri http://192.168.2.34:18080/health
```

**Browser:**
Navigate to http://192.168.2.34:3000/api/docs (or :18080 for fallback)

---

## Common Operations

### View Logs

```powershell
# All services
docker compose -f docker-compose.local-staging.yml logs -f

# Application only
docker compose -f docker-compose.local-staging.yml logs -f app

# Database only
docker compose -f docker-compose.local-staging.yml logs -f postgres
```

### Stop the System

```powershell
docker compose -f docker-compose.local-staging.yml down
```

### Stop and Remove Data

```powershell
# WARNING: This deletes all database data
docker compose -f docker-compose.local-staging.yml down -v
```

### Restart the System

```powershell
docker compose -f docker-compose.local-staging.yml restart
```

### Rebuild After Updates

```powershell
git fetch --all --tags
git checkout tags/<new-tag>

# Standard port (secure):
docker compose -f docker-compose.local-staging.yml -f docker-compose.secure.override.yml up -d --build

# Or fallback port (secure):
docker compose -f docker-compose.local-staging.yml -f docker-compose.ports.override.yml up -d --build
```

---

## Database Access (Admin Only)

PostgreSQL is not exposed to the network. To access the database, use Docker exec:

```powershell
# PostgreSQL shell (from Windows host)
docker compose -f docker-compose.local-staging.yml exec postgres psql -U vsys -d vsys_next_staging
```

**Note**: This is the ONLY way to access the database directly. Remote database connections are not possible by design.

---

## Troubleshooting

### Container Fails to Start

1. Check logs:
   ```powershell
   docker compose -f docker-compose.local-staging.yml logs app
   ```

2. Verify Docker Desktop is running with WSL2

3. Check port conflict:
   ```powershell
   netstat -ano | findstr :3000
   ```

### Database Connection Failed

1. Check PostgreSQL container:
   ```powershell
   docker compose -f docker-compose.local-staging.yml ps postgres
   ```

2. Check PostgreSQL logs:
   ```powershell
   docker compose -f docker-compose.local-staging.yml logs postgres
   ```

3. Verify database readiness:
   ```powershell
   docker compose -f docker-compose.local-staging.yml exec postgres pg_isready -U vsys
   ```

### Cannot Access from LAN

1. Verify firewall rules exist:
   ```powershell
   Get-NetFirewallRule -DisplayName "VSys*"
   ```

2. Check Docker is binding to all interfaces:
   ```powershell
   netstat -ano | findstr :3000
   # Should show 0.0.0.0:3000, NOT 127.0.0.1:3000
   ```

3. Test firewall temporarily:
   ```powershell
   # Disable (testing only!)
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

   # Test access, then re-enable:
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
   ```

### Health Check Returns Error

1. Wait 60 seconds - the app needs time to initialize
2. Check logs for errors:
   ```powershell
   docker compose -f docker-compose.local-staging.yml logs app --tail 50
   ```

---

## Quick Reference

### Standard Port (3000)

| Action | Command |
|--------|---------|
| Start | `docker compose -f docker-compose.local-staging.yml -f docker-compose.secure.override.yml up -d --build` |
| Stop | `docker compose -f docker-compose.local-staging.yml down` |
| Status | `docker compose -f docker-compose.local-staging.yml ps` |
| Logs | `docker compose -f docker-compose.local-staging.yml logs -f` |
| Health | `Invoke-RestMethod -Uri http://localhost:3000/health` |

### Fallback Port (18080)

| Action | Command |
|--------|---------|
| Start | `docker compose -f docker-compose.local-staging.yml -f docker-compose.ports.override.yml up -d --build` |
| Stop | `docker compose -f docker-compose.local-staging.yml down` |
| Health | `Invoke-RestMethod -Uri http://localhost:18080/health` |

---

## Security Summary

| Component | Network Exposure | Access Method |
|-----------|------------------|---------------|
| API (NestJS) | LAN (port 3000 or 18080) | HTTP from any LAN computer |
| Swagger Docs | LAN (port 3000 or 18080) | Browser at /api/docs |
| PostgreSQL | **None** | Docker exec only |

**Key Security Points:**
- PostgreSQL is **NOT** exposed to the network
- No firewall rules for database ports
- Database accessible only via `docker exec` from the Windows host
- All external access goes through the API layer

---

## Version Information

| Component | Version |
|-----------|---------|
| VSys Next | v0.1.0-module-core |
| Module | Core Wash Registration & Ledger |
| Node.js | 20+ |
| PostgreSQL | 16 |
