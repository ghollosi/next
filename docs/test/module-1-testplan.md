# Module 1: Test Plan

## Overview

This document outlines the test plan for Module 1: Core Wash Registration & Wash Ledger.

## Test Categories

### 1. Unit Tests

Located in: `src/**/*.spec.ts`

#### WashEventService Tests (`wash-event.service.spec.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| WE-U01 | Find wash event by ID | Returns event when found |
| WE-U02 | Find wash event by ID - not found | Throws NotFoundException |
| WE-U03 | Create QR driver wash event | Creates event with CREATED status |
| WE-U04 | Create QR driver - driver not found | Throws BadRequestException |
| WE-U05 | Create QR driver - location not found | Throws BadRequestException |
| WE-U06 | Create QR driver - service not available | Throws BadRequestException |
| WE-U07 | Create QR driver - no tractor info | Throws BadRequestException |
| WE-U08 | Authorize: CREATED → AUTHORIZED | Updates status, sets authorizedAt |
| WE-U09 | Authorize: invalid transition | Throws BadRequestException |
| WE-U10 | Start: AUTHORIZED → IN_PROGRESS | Updates status, sets startedAt |
| WE-U11 | Start: CREATED → IN_PROGRESS | Throws BadRequestException |
| WE-U12 | Complete: IN_PROGRESS → COMPLETED | Updates status, sets completedAt |
| WE-U13 | Reject: CREATED → REJECTED | Updates status with reason |
| WE-U14 | Reject: AUTHORIZED → REJECTED | Updates status with reason |
| WE-U15 | Reject: COMPLETED → REJECTED | Throws BadRequestException |
| WE-U16 | Lock: COMPLETED → LOCKED | Updates status, sets lockedAt |
| WE-U17 | Lock: IN_PROGRESS → LOCKED | Throws BadRequestException |

#### DriverService Tests (`driver.service.spec.ts`)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| DR-U01 | Find driver by ID | Returns driver with partnerCompany |
| DR-U02 | Find driver - not found | Throws NotFoundException |
| DR-U03 | Create driver | Creates driver with invite code |
| DR-U04 | Activate with valid invite and PIN | Activates invite, returns driver |
| DR-U05 | Activate with invalid invite code | Throws NotFoundException |
| DR-U06 | Activate already used invite | Throws BadRequestException |
| DR-U07 | Activate expired invite | Throws BadRequestException |
| DR-U08 | Activate with wrong PIN | Throws UnauthorizedException |
| DR-U09 | Soft delete driver | Sets deletedAt and isActive=false |

### 2. End-to-End Tests

Located in: `test/app.e2e-spec.ts`

#### Health Check Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| HC-E01 | GET /health | 200 with status, version, module |
| HC-E02 | GET /health/ready | 200 with status='ready' |
| HC-E03 | GET /health/live | 200 with status='alive' |

#### PWA Driver Activation Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PWA-E01 | Activate with valid code and PIN | 200 with sessionId and driver info |
| PWA-E02 | Activate with invalid code | 404 |
| PWA-E03 | Activate with wrong PIN | 400 (already activated) or 401 |

#### PWA Driver Profile Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PWA-E04 | Get profile with valid session | 200 with driver info |
| PWA-E05 | Get profile without session | 400 |
| PWA-E06 | Get profile with invalid session | 400 |

#### PWA Wash Event Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PWA-E07 | Create wash event | 201 with event in CREATED status |
| PWA-E08 | Start wash event | 200 with IN_PROGRESS status |
| PWA-E09 | Complete wash event | 200 with COMPLETED status |
| PWA-E10 | Create with invalid location | 400 |

#### Operator Wash Event Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| OP-E01 | Create manual wash event | 201 with MANUAL_OPERATOR mode |
| OP-E02 | Authorize wash event | 200 with AUTHORIZED status |
| OP-E03 | Start wash event | 200 with IN_PROGRESS status |
| OP-E04 | Complete wash event | 200 with COMPLETED status |
| OP-E05 | List wash events | 200 with data array and total |
| OP-E06 | Reject wash event | 200 with REJECTED status and reason |

#### State Machine Immutability Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| SM-E01 | Reject completed event | 400 |
| SM-E02 | Restart completed event | 400 |

### 3. Integration Tests (Database)

Covered by e2e tests with real database connection.

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| DB-I01 | Network isolation | Queries return only matching network |
| DB-I02 | Soft delete preservation | Deleted records not returned |
| DB-I03 | Audit log creation | Logs created for all actions |

## Test Execution

### Running Unit Tests

```bash
npm test                    # Run all unit tests
npm run test:watch          # Run in watch mode
npm run test:cov            # Run with coverage
```

### Running E2E Tests

```bash
# Ensure database is running
docker-compose up -d postgres

# Run migrations
npm run prisma:migrate

# Run e2e tests
npm run test:e2e
```

## Test Data Setup

E2E tests automatically:
1. Clean the database before tests
2. Seed required test data:
   - One network
   - One location
   - One partner company
   - One service package
   - Service availability at location
   - One driver with invite code

## Coverage Requirements

| Category | Minimum Coverage |
|----------|------------------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

## Manual Testing Checklist

### PWA Flow

- [ ] Scan QR code (location code)
- [ ] Enter invite code
- [ ] Enter PIN
- [ ] View profile
- [ ] View vehicles
- [ ] View available services
- [ ] Create wash event
- [ ] Start wash
- [ ] Complete wash
- [ ] View wash history

### Operator Flow

- [ ] Select location
- [ ] Select partner company
- [ ] Enter driver name
- [ ] Select service
- [ ] Enter tractor plate
- [ ] Create wash event
- [ ] Authorize wash
- [ ] Start wash
- [ ] Complete wash
- [ ] View wash list
- [ ] Reject a wash (with reason)

### Error Handling

- [ ] Invalid invite code shows error
- [ ] Wrong PIN shows error
- [ ] Invalid location shows error
- [ ] Missing required fields show validation errors
- [ ] Expired session redirects to activation

## Regression Testing

Before each release:
1. Run full unit test suite
2. Run full e2e test suite
3. Perform manual testing of critical flows
4. Verify audit logs are created correctly
5. Verify tenant isolation works correctly
