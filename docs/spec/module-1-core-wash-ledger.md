# Module 1: Core Wash Registration & Wash Ledger

## Version
- **Module Version**: v0.1.0
- **Git Tag**: v0.1.0-module-core

## Overview

Module 1 establishes the foundation of VSys Next, a multi-tenant wash registration and ledger system. This module provides core functionality for:

- Multi-tenant network management
- Location (wash station) management
- Partner company management
- Driver registration and PWA activation
- Vehicle tracking (tractors and trailers)
- Service package definition
- Wash event creation, state management, and audit logging

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Framework | NestJS |
| ORM | Prisma |
| Database | PostgreSQL |
| Container | Docker + docker-compose |

## Fundamental Rules

1. **Multi-tenant**: Every table includes `network_id`
2. **Query Scoping**: Every query enforces `network_id` filtering
3. **Soft Delete**: Records are never hard-deleted
4. **Immutability**: WashEvent is immutable after COMPLETED
5. **UTC Timestamps**: All timestamps are stored in UTC
6. **Audit Logging**: All actions are logged
7. **Server-Side Validation**: The system does not trust the client

## Domain Entities

### Network (Tenant)
The top-level tenant entity. All other entities belong to a network.

```typescript
{
  id: UUID
  name: string
  slug: string (unique)
  isActive: boolean
  createdAt: DateTime
  updatedAt: DateTime
  deletedAt: DateTime?
}
```

### Location (Wash Station)
Physical wash locations within a network.

```typescript
{
  id: UUID
  networkId: UUID (FK)
  name: string
  code: string (unique per network)
  address: string?
  city: string?
  state: string?
  zipCode: string?
  country: string (default: 'US')
  timezone: string (default: 'UTC')
  isActive: boolean
  ...timestamps
}
```

### PartnerCompany
Trucking companies or fleet operators that use the wash services.

```typescript
{
  id: UUID
  networkId: UUID (FK)
  name: string
  code: string (unique per network)
  contactName: string?
  email: string?
  phone: string?
  isActive: boolean
  ...timestamps
}
```

### Driver
Individual drivers associated with partner companies.

```typescript
{
  id: UUID
  networkId: UUID (FK)
  partnerCompanyId: UUID (FK)
  firstName: string
  lastName: string
  phone: string?
  email: string?
  pinHash: string (SHA-256 hashed PIN)
  isActive: boolean
  ...timestamps
}
```

### DriverInvite
Invitation codes for PWA activation.

```typescript
{
  id: UUID
  networkId: UUID (FK)
  driverId: UUID (FK, unique)
  inviteCode: string (6 chars, unique)
  status: PENDING | ACTIVATED | EXPIRED | REVOKED
  expiresAt: DateTime
  activatedAt: DateTime?
  ...timestamps
}
```

### Vehicle
Tractors and trailers owned by partner companies.

```typescript
{
  id: UUID
  networkId: UUID (FK)
  partnerCompanyId: UUID (FK)
  type: TRACTOR | TRAILER
  plateNumber: string
  plateState: string?
  make: string?
  model: string?
  year: number?
  isActive: boolean
  ...timestamps
}
```

### ServicePackage
Types of wash services offered.

```typescript
{
  id: UUID
  networkId: UUID (FK)
  name: string
  code: string (unique per network)
  description: string?
  isActive: boolean
  ...timestamps
}
```

### LocationServiceAvailability
Junction table linking services to locations.

```typescript
{
  id: UUID
  networkId: UUID (FK)
  locationId: UUID (FK)
  servicePackageId: UUID (FK)
  isActive: boolean
  ...timestamps
}
```

### WashEvent (Core Ledger Entry)
The immutable wash event record.

```typescript
{
  id: UUID
  networkId: UUID (FK)
  locationId: UUID (FK)
  partnerCompanyId: UUID (FK)
  servicePackageId: UUID (FK)

  entryMode: QR_DRIVER | MANUAL_OPERATOR
  status: CREATED | AUTHORIZED | IN_PROGRESS | COMPLETED | LOCKED | REJECTED

  // Driver info
  driverId: UUID? (FK, for QR_DRIVER)
  driverNameManual: string? (for MANUAL_OPERATOR)

  // Vehicle info
  tractorVehicleId: UUID? (FK)
  tractorPlateManual: string?
  trailerVehicleId: UUID? (FK)
  trailerPlateManual: string?

  // Operator info
  createdByUserId: string? (for MANUAL_OPERATOR)

  // State transition timestamps
  authorizedAt: DateTime?
  startedAt: DateTime?
  completedAt: DateTime?
  lockedAt: DateTime?
  rejectedAt: DateTime?
  rejectionReason: string?

  ...timestamps
}
```

### AuditLog
Append-only audit trail.

```typescript
{
  id: UUID
  networkId: UUID (FK)
  washEventId: UUID? (FK)
  action: CREATE | UPDATE | START | COMPLETE | REJECT | AUTHORIZE | LOCK
  actorType: USER | DRIVER | SYSTEM
  actorId: string?
  previousData: JSON?
  newData: JSON?
  metadata: JSON?
  ipAddress: string?
  userAgent: string?
  createdAt: DateTime
}
```

## Wash Event State Machine

```
                    ┌─────────────┐
                    │   CREATED   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            │            ▼
       ┌──────────┐        │     ┌──────────┐
       │ REJECTED │        │     │AUTHORIZED│
       └──────────┘        │     └────┬─────┘
                           │          │
                           │    ┌─────┼─────┐
                           │    ▼     │     │
                           │ ┌────────┴───┐ │
                           │ │IN_PROGRESS │ │
                           │ └─────┬──────┘ │
                           │       │        │
                           │       ▼        ▼
                           │ ┌──────────┐ ┌──────────┐
                           │ │COMPLETED │ │ REJECTED │
                           │ └────┬─────┘ └──────────┘
                           │      │
                           │      ▼
                           │ ┌──────────┐
                           │ │  LOCKED  │
                           │ └──────────┘
                           │
```

### Valid State Transitions

| From State | To States |
|------------|-----------|
| CREATED | AUTHORIZED, REJECTED |
| AUTHORIZED | IN_PROGRESS, REJECTED |
| IN_PROGRESS | COMPLETED |
| COMPLETED | LOCKED |
| LOCKED | (none - terminal) |
| REJECTED | (none - terminal) |

### Illegal Operations

- Skipping states (e.g., CREATED → COMPLETED)
- Modifying COMPLETED or LOCKED events
- Deleting WashEvents (never allowed)

## Entry Modes

### QR_DRIVER Mode
Driver initiates wash via PWA after scanning QR code.

**Required fields**:
- `partner_company_id` (from driver's profile)
- `driver_id`
- `service_package_id`
- `location_id` (from QR code)
- Tractor: `vehicle_id` OR `manual_plate`

**Optional fields**:
- Trailer: `vehicle_id` OR `manual_plate`

### MANUAL_OPERATOR Mode
Operator creates wash event for walk-in or phone orders.

**Required fields**:
- `partner_company_id`
- `driver_name_manual`
- `service_package_id`
- `tractor_plate_manual`
- `created_by_user_id`
- `location_id`

**Optional fields**:
- `trailer_plate_manual`

## API Endpoints

### PWA Endpoints (Driver)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/pwa/activate` | Activate driver with invite code + PIN |
| GET | `/pwa/me` | Get driver profile |
| GET | `/pwa/vehicles` | Get driver's vehicles |
| GET | `/pwa/locations/:code/services` | Get services at location |
| POST | `/pwa/wash-events` | Create wash event |
| POST | `/pwa/wash-events/:id/start` | Start wash |
| POST | `/pwa/wash-events/:id/complete` | Complete wash |
| GET | `/pwa/wash-events` | Get driver's wash history |

### Operator Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/operator/wash-events` | Create wash event (manual) |
| GET | `/operator/wash-events` | List wash events |
| GET | `/operator/wash-events/:id` | Get wash event details |
| POST | `/operator/wash-events/:id/authorize` | Authorize wash |
| POST | `/operator/wash-events/:id/start` | Start wash |
| POST | `/operator/wash-events/:id/complete` | Complete wash |
| POST | `/operator/wash-events/:id/reject` | Reject wash |
| GET | `/operator/partner-companies` | List partner companies |
| GET | `/operator/locations` | List locations |
| GET | `/operator/locations/:id/services` | List location services |

### Required Headers (Operator)

- `X-Network-ID`: Network (tenant) ID
- `X-User-ID`: Operator user ID

### Health Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check with DB status |
| GET | `/health/ready` | Readiness probe |
| GET | `/health/live` | Liveness probe |

## Tenant Isolation

- All Prisma queries MUST include `networkId` in the WHERE clause
- If tenant mismatch occurs, return 404 (not 403) to prevent enumeration
- Network validation happens at the service layer

## Audit Logging

- Append-only: logs cannot be modified or deleted
- Required for: CREATE, START, COMPLETE, REJECT, AUTHORIZE, LOCK
- Stores: actor type (USER/DRIVER/SYSTEM), actor ID, previous/new data
- Includes request metadata: IP address, user agent

## Database Migrations

Run migrations with:
```bash
npx prisma migrate dev        # Development
npx prisma migrate deploy     # Production
```

## Running the Application

### Development
```bash
docker-compose up -d          # Start PostgreSQL
npm run prisma:generate       # Generate Prisma client
npm run prisma:migrate        # Run migrations
npm run start:dev             # Start in watch mode
```

### Local Staging (Windows)
```bash
docker-compose -f docker-compose.local-staging.yml up -d
```

### API Documentation
Swagger UI available at: `http://localhost:3000/api/docs`

## Security Considerations

- All validation is server-side
- PIN is hashed with SHA-256
- Invite codes are 6 random alphanumeric characters
- Session management (placeholder - to be enhanced with JWT)
- No sensitive data in error messages
