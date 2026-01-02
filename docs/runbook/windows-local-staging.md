# Windows Local Staging Runbook

## Overview

This runbook provides step-by-step instructions for setting up and running VSys Next Module 1 on a Windows development machine using Docker Desktop with WSL2.

## Prerequisites

### Required Software

1. **Windows 10/11 Pro, Enterprise, or Education** (for Hyper-V)
2. **WSL2** (Windows Subsystem for Linux 2)
3. **Docker Desktop for Windows** with WSL2 backend
4. **Node.js 20+** (optional, for local development)
5. **Git for Windows**

### Installing WSL2

Open PowerShell as Administrator:

```powershell
wsl --install
```

Restart your computer when prompted.

### Installing Docker Desktop

1. Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop)
2. Run the installer
3. Enable WSL2 backend during installation
4. Restart your computer if prompted

### Verifying Installation

Open PowerShell:

```powershell
docker --version
docker-compose --version
wsl --list --verbose
```

## Initial Setup

### 1. Clone the Repository

```powershell
cd C:\Projects  # or your preferred directory
git clone <repository-url> vsys-next
cd vsys-next
```

### 2. Environment Configuration

Copy the example environment file:

```powershell
copy .env.example .env
```

Edit `.env` if needed (defaults work for local staging):

```env
DATABASE_URL="postgresql://vsys:vsys_staging_password@localhost:5432/vsys_next_staging?schema=public"
NODE_ENV=staging
PORT=3000
```

## Starting the Application

### Using docker-compose

```powershell
# Start all services
docker-compose -f docker-compose.local-staging.yml up -d

# View logs
docker-compose -f docker-compose.local-staging.yml logs -f

# Check status
docker-compose -f docker-compose.local-staging.yml ps
```

### Verifying the Application

1. **Health Check**: Open browser to `http://localhost:3000/health`

   Expected response:
   ```json
   {
     "status": "ok",
     "version": "0.1.0",
     "module": "core-wash-ledger",
     "database": "connected"
   }
   ```

2. **Swagger Documentation**: Open browser to `http://localhost:3000/api/docs`

## Common Operations

### Viewing Logs

```powershell
# All services
docker-compose -f docker-compose.local-staging.yml logs -f

# Application only
docker-compose -f docker-compose.local-staging.yml logs -f app

# Database only
docker-compose -f docker-compose.local-staging.yml logs -f postgres
```

### Stopping the Application

```powershell
docker-compose -f docker-compose.local-staging.yml down
```

### Stopping and Removing Data

```powershell
docker-compose -f docker-compose.local-staging.yml down -v
```

### Rebuilding After Code Changes

```powershell
docker-compose -f docker-compose.local-staging.yml build --no-cache
docker-compose -f docker-compose.local-staging.yml up -d
```

## Database Operations

### Running Migrations

Migrations run automatically on container startup. To run manually:

```powershell
docker-compose -f docker-compose.local-staging.yml exec app npx prisma migrate deploy
```

### Accessing the Database

Using psql:

```powershell
docker-compose -f docker-compose.local-staging.yml exec postgres psql -U vsys -d vsys_next_staging
```

Common SQL commands:

```sql
-- List tables
\dt

-- View wash events
SELECT * FROM wash_events LIMIT 10;

-- View audit logs
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;

-- Exit
\q
```

### Database Backup

```powershell
docker-compose -f docker-compose.local-staging.yml exec postgres pg_dump -U vsys vsys_next_staging > backup.sql
```

### Database Restore

```powershell
cat backup.sql | docker-compose -f docker-compose.local-staging.yml exec -T postgres psql -U vsys vsys_next_staging
```

## Troubleshooting

### Port Already in Use

If port 3000 or 5432 is already in use:

1. Find the process:
   ```powershell
   netstat -ano | findstr :3000
   netstat -ano | findstr :5432
   ```

2. Kill the process:
   ```powershell
   taskkill /PID <pid> /F
   ```

3. Or change ports in docker-compose.local-staging.yml

### Docker Desktop Not Starting

1. Ensure Hyper-V is enabled:
   ```powershell
   Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
   ```

2. Restart computer

3. Check WSL2 status:
   ```powershell
   wsl --status
   ```

### Container Fails to Start

1. Check logs:
   ```powershell
   docker-compose -f docker-compose.local-staging.yml logs app
   ```

2. Common issues:
   - Database not ready: Wait a few seconds and retry
   - Port conflict: Change ports
   - Memory: Increase Docker Desktop memory allocation

### Database Connection Failed

1. Check if postgres container is running:
   ```powershell
   docker-compose -f docker-compose.local-staging.yml ps
   ```

2. Check postgres logs:
   ```powershell
   docker-compose -f docker-compose.local-staging.yml logs postgres
   ```

3. Verify connection:
   ```powershell
   docker-compose -f docker-compose.local-staging.yml exec postgres pg_isready -U vsys
   ```

### WSL2 Performance Issues

If using WSL2 and experiencing slow file access:

1. Move project to WSL2 filesystem:
   ```bash
   # In WSL2 terminal
   cd ~
   git clone <repository-url> vsys-next
   cd vsys-next
   docker-compose -f docker-compose.local-staging.yml up -d
   ```

2. Access from Windows via `\\wsl$\Ubuntu\home\<username>\vsys-next`

## Resource Configuration

### Docker Desktop Resources

Recommended settings (Docker Desktop > Settings > Resources):

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPUs | 2 | 4 |
| Memory | 4 GB | 8 GB |
| Disk | 20 GB | 50 GB |

## Security Notes

⚠️ **Important**: The local staging configuration uses weak passwords for convenience. Never use these credentials in production.

Default credentials:
- PostgreSQL User: `vsys`
- PostgreSQL Password: `vsys_staging_password`
- Database: `vsys_next_staging`

## Running Tests

### Unit Tests

Unit tests do not require any database and can be run directly:

```powershell
npm test
```

Expected output:
```
PASS src/modules/driver/driver.service.spec.ts
PASS src/modules/wash-event/wash-event.service.spec.ts

Test Suites: 2 passed, 2 total
Tests:       26 passed, 26 total
```

### E2E Tests

E2E tests require Docker. The test script automatically manages a test database:

```powershell
.\scripts\test-e2e.ps1
```

The script will:
1. Start a PostgreSQL test container (port 5433)
2. Run database migrations
3. Execute all e2e tests
4. Clean up the test container

**Note**: The e2e test database uses port 5433 to avoid conflicts with the development database on port 5432.

Test database credentials (for debugging):
- Host: `localhost`
- Port: `5433`
- User: `vsys_test`
- Password: `vsys_test_password`
- Database: `vsys_next_test`

### Troubleshooting Tests

If e2e tests fail to start:

1. Ensure Docker Desktop is running
2. Check if port 5433 is available:
   ```powershell
   netstat -ano | findstr :5433
   ```
3. Manually clean up stale test containers:
   ```powershell
   docker-compose -f docker-compose.test.yml down -v --remove-orphans
   ```

## Quick Reference

| Action | Command |
|--------|---------|
| Start | `docker-compose -f docker-compose.local-staging.yml up -d` |
| Stop | `docker-compose -f docker-compose.local-staging.yml down` |
| Logs | `docker-compose -f docker-compose.local-staging.yml logs -f` |
| Rebuild | `docker-compose -f docker-compose.local-staging.yml build --no-cache` |
| Status | `docker-compose -f docker-compose.local-staging.yml ps` |
| Shell | `docker-compose -f docker-compose.local-staging.yml exec app sh` |
| DB Shell | `docker-compose -f docker-compose.local-staging.yml exec postgres psql -U vsys -d vsys_next_staging` |
| Unit Tests | `npm test` |
| E2E Tests | `.\scripts\test-e2e.ps1` |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `http://localhost:3000/health` | Health check |
| `http://localhost:3000/api/docs` | Swagger documentation |
| `http://localhost:3000/pwa/*` | PWA driver endpoints |
| `http://localhost:3000/operator/*` | Operator endpoints |
