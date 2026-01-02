-- VSys Next Module 1: Initial Migration
-- CreateEnum
CREATE TYPE "WashEventStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'IN_PROGRESS', 'COMPLETED', 'LOCKED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WashEntryMode" AS ENUM ('QR_DRIVER', 'MANUAL_OPERATOR');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TRACTOR', 'TRAILER');

-- CreateEnum
CREATE TYPE "DriverInviteStatus" AS ENUM ('PENDING', 'ACTIVATED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'START', 'COMPLETE', 'REJECT', 'AUTHORIZE', 'LOCK');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'DRIVER');

-- CreateTable
CREATE TABLE "networks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_companies" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "partner_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "partner_company_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "pin_hash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_invites" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "invite_code" TEXT NOT NULL,
    "status" "DriverInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "activated_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "partner_company_id" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "plate_number" TEXT NOT NULL,
    "plate_state" TEXT,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_packages" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_service_availability" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "service_package_id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_service_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wash_events" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "partner_company_id" TEXT NOT NULL,
    "service_package_id" TEXT NOT NULL,
    "entry_mode" "WashEntryMode" NOT NULL,
    "status" "WashEventStatus" NOT NULL DEFAULT 'CREATED',
    "driver_id" TEXT,
    "driver_name_manual" TEXT,
    "tractor_vehicle_id" TEXT,
    "tractor_plate_manual" TEXT,
    "trailer_vehicle_id" TEXT,
    "trailer_plate_manual" TEXT,
    "created_by_user_id" TEXT,
    "authorized_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wash_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "wash_event_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" TEXT,
    "previous_data" JSONB,
    "new_data" JSONB,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "networks_slug_key" ON "networks"("slug");

-- CreateIndex
CREATE INDEX "locations_network_id_idx" ON "locations"("network_id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_network_id_code_key" ON "locations"("network_id", "code");

-- CreateIndex
CREATE INDEX "partner_companies_network_id_idx" ON "partner_companies"("network_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_companies_network_id_code_key" ON "partner_companies"("network_id", "code");

-- CreateIndex
CREATE INDEX "drivers_network_id_idx" ON "drivers"("network_id");

-- CreateIndex
CREATE INDEX "drivers_partner_company_id_idx" ON "drivers"("partner_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_invites_driver_id_key" ON "driver_invites"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_invites_invite_code_key" ON "driver_invites"("invite_code");

-- CreateIndex
CREATE INDEX "driver_invites_network_id_idx" ON "driver_invites"("network_id");

-- CreateIndex
CREATE INDEX "driver_invites_invite_code_idx" ON "driver_invites"("invite_code");

-- CreateIndex
CREATE INDEX "vehicles_network_id_idx" ON "vehicles"("network_id");

-- CreateIndex
CREATE INDEX "vehicles_partner_company_id_idx" ON "vehicles"("partner_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_network_id_plate_number_plate_state_key" ON "vehicles"("network_id", "plate_number", "plate_state");

-- CreateIndex
CREATE INDEX "service_packages_network_id_idx" ON "service_packages"("network_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_packages_network_id_code_key" ON "service_packages"("network_id", "code");

-- CreateIndex
CREATE INDEX "location_service_availability_network_id_idx" ON "location_service_availability"("network_id");

-- CreateIndex
CREATE INDEX "location_service_availability_location_id_idx" ON "location_service_availability"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "location_service_availability_location_id_service_package_i_key" ON "location_service_availability"("location_id", "service_package_id");

-- CreateIndex
CREATE INDEX "wash_events_network_id_idx" ON "wash_events"("network_id");

-- CreateIndex
CREATE INDEX "wash_events_location_id_idx" ON "wash_events"("location_id");

-- CreateIndex
CREATE INDEX "wash_events_partner_company_id_idx" ON "wash_events"("partner_company_id");

-- CreateIndex
CREATE INDEX "wash_events_driver_id_idx" ON "wash_events"("driver_id");

-- CreateIndex
CREATE INDEX "wash_events_status_idx" ON "wash_events"("status");

-- CreateIndex
CREATE INDEX "wash_events_createdAt_idx" ON "wash_events"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_network_id_idx" ON "audit_logs"("network_id");

-- CreateIndex
CREATE INDEX "audit_logs_wash_event_id_idx" ON "audit_logs"("wash_event_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_actor_type_idx" ON "audit_logs"("actor_type");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_companies" ADD CONSTRAINT "partner_companies_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_partner_company_id_fkey" FOREIGN KEY ("partner_company_id") REFERENCES "partner_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_invites" ADD CONSTRAINT "driver_invites_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_invites" ADD CONSTRAINT "driver_invites_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_partner_company_id_fkey" FOREIGN KEY ("partner_company_id") REFERENCES "partner_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_service_availability" ADD CONSTRAINT "location_service_availability_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_service_availability" ADD CONSTRAINT "location_service_availability_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_service_availability" ADD CONSTRAINT "location_service_availability_service_package_id_fkey" FOREIGN KEY ("service_package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_events" ADD CONSTRAINT "wash_events_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_events" ADD CONSTRAINT "wash_events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_events" ADD CONSTRAINT "wash_events_partner_company_id_fkey" FOREIGN KEY ("partner_company_id") REFERENCES "partner_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_events" ADD CONSTRAINT "wash_events_service_package_id_fkey" FOREIGN KEY ("service_package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_events" ADD CONSTRAINT "wash_events_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_events" ADD CONSTRAINT "wash_events_tractor_vehicle_id_fkey" FOREIGN KEY ("tractor_vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_events" ADD CONSTRAINT "wash_events_trailer_vehicle_id_fkey" FOREIGN KEY ("trailer_vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_wash_event_id_fkey" FOREIGN KEY ("wash_event_id") REFERENCES "wash_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
