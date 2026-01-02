# VSys Next

Multi-tenant Wash Registration & Ledger System

## Version

- **Current**: v0.1.0
- **Module**: Core Wash Registration & Wash Ledger

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)

### Development Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up -d postgres

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed demo data (optional)
npm run db:seed

# Start development server
npm run start:dev
```

### Windows Local Staging

```bash
docker-compose -f docker-compose.local-staging.yml up -d
```

Access:
- API: http://localhost:3000
- Swagger: http://localhost:3000/api/docs

## Demo Credentials

After running `npm run db:seed`:

- **Invite Code**: `DEMO01`
- **PIN**: `1234`
- **Location Codes**: `WASH001`, `WASH002`

## Project Structure

```
vsys-next/
├── src/
│   ├── common/           # Shared utilities
│   │   ├── prisma/       # Database service
│   │   ├── health/       # Health checks
│   │   ├── types/        # Type definitions
│   │   └── filters/      # Exception filters
│   ├── modules/          # Domain modules
│   │   ├── network/
│   │   ├── location/
│   │   ├── partner-company/
│   │   ├── driver/
│   │   ├── vehicle/
│   │   ├── service-package/
│   │   ├── wash-event/
│   │   └── audit-log/
│   ├── pwa/              # PWA driver endpoints
│   └── operator/         # Operator endpoints
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Demo data seeder
├── docs/
│   ├── spec/             # Specifications
│   ├── test/             # Test plans
│   └── runbook/          # Operational guides
└── test/                 # E2E tests
```

## API Endpoints

### Health
- `GET /health` - System health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### PWA (Driver)
- `POST /pwa/activate` - Activate with invite code + PIN
- `GET /pwa/me` - Get profile
- `POST /pwa/wash-events` - Create wash event
- `POST /pwa/wash-events/:id/start` - Start wash
- `POST /pwa/wash-events/:id/complete` - Complete wash

### Operator
- `POST /operator/wash-events` - Create manual wash event
- `GET /operator/wash-events` - List wash events
- `POST /operator/wash-events/:id/authorize` - Authorize
- `POST /operator/wash-events/:id/start` - Start
- `POST /operator/wash-events/:id/complete` - Complete
- `POST /operator/wash-events/:id/reject` - Reject

## Testing

### Unit Tests

Unit tests run without any external dependencies:

```bash
npm test
```

### E2E Tests

E2E tests require Docker. The test script automatically:
1. Starts a PostgreSQL test database (port 5433)
2. Runs database migrations
3. Executes all e2e tests
4. Cleans up the test database

**macOS/Linux:**
```bash
npm run test:e2e
```

**Windows (PowerShell):**
```powershell
.\scripts\test-e2e.ps1
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Build for production |
| `npm test` | Run unit tests (no DB required) |
| `npm run test:e2e` | Run e2e tests (auto-starts test DB) |
| `npm run test:e2e:ci` | Run e2e tests (requires existing DB) |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run migrations |
| `npm run db:seed` | Seed demo data |

## Documentation

- [Module 1 Specification](docs/spec/module-1-core-wash-ledger.md)
- [Changelog](docs/changelog.md)
- [Test Plan](docs/test/module-1-testplan.md)
- [Windows Runbook](docs/runbook/windows-local-staging.md)

## License

PROPRIETARY - All Rights Reserved
