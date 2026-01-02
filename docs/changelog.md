# Changelog

All notable changes to VSys Next will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-02

### Module 1: Core Wash Registration & Wash Ledger

Git Tag: `v0.1.0-module-core`

#### Added

**Domain Entities**
- Network (multi-tenant support)
- Location (wash stations)
- PartnerCompany (fleet operators)
- Driver (with PIN authentication)
- DriverInvite (PWA activation codes)
- Vehicle (tractors and trailers)
- ServicePackage (wash service types)
- LocationServiceAvailability (service-location mapping)
- WashEvent (immutable wash ledger)
- AuditLog (append-only audit trail)

**Wash Event State Machine**
- States: CREATED, AUTHORIZED, IN_PROGRESS, COMPLETED, LOCKED, REJECTED
- Enforced state transitions
- Immutability for COMPLETED and LOCKED events

**Entry Modes**
- QR_DRIVER: Driver-initiated via PWA
- MANUAL_OPERATOR: Operator-initiated for walk-ins

**API Endpoints**
- PWA endpoints for driver activation and wash management
- Operator endpoints for manual wash creation and management
- Health check endpoints (health, ready, live)

**Infrastructure**
- NestJS application structure
- Prisma ORM with PostgreSQL
- Docker and docker-compose configurations
- Windows local staging support

**Testing**
- Unit tests for WashEventService
- Unit tests for DriverService
- End-to-end API tests

**Documentation**
- Module 1 specification
- Test plan
- Windows local staging runbook

#### Security
- Multi-tenant isolation (network_id scoping)
- Server-side validation only
- PIN hashing (SHA-256)
- Audit logging for all wash event actions

#### Technical Decisions
- Soft delete pattern (no hard deletes)
- UTC timestamps for all date/time fields
- UUID primary keys
- Append-only audit log

---

## Future Modules (Planned)

- Module 2: User Management & Authentication
- Module 3: Billing & Invoicing
- Module 4: Reporting & Analytics
- Module 5: Fleet Management
