-- Migration: Independent Customer & Location Visibility
-- Date: 2026-01-16
-- Description:
--   1. Driver.partnerCompanyId nullable (privát ügyfél támogatás)
--   2. Location visibility + dedicatedPartnerIds
--   3. WashEvent walk-in számlázási mezők
--   4. Invoice nullable partnerCompanyId + driverId

-- =============================================================================
-- 1. LocationVisibility enum létrehozása
-- =============================================================================
CREATE TYPE "LocationVisibility" AS ENUM ('PUBLIC', 'NETWORK_ONLY', 'DEDICATED');

-- =============================================================================
-- 2. Driver modell módosítás - partnerCompanyId nullable
-- =============================================================================
ALTER TABLE "drivers"
  ALTER COLUMN "partner_company_id" DROP NOT NULL;

-- =============================================================================
-- 3. Location modell módosítás - visibility és dedicatedPartnerIds
-- =============================================================================
ALTER TABLE "locations"
  ADD COLUMN "visibility" "LocationVisibility" NOT NULL DEFAULT 'NETWORK_ONLY',
  ADD COLUMN "dedicated_partner_ids" TEXT[] DEFAULT '{}';

-- =============================================================================
-- 4. WashEvent modell módosítás - partnerCompanyId nullable + walk-in mezők
-- =============================================================================
ALTER TABLE "wash_events"
  ALTER COLUMN "partner_company_id" DROP NOT NULL;

ALTER TABLE "wash_events"
  ADD COLUMN "walk_in_invoice_requested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "walk_in_billing_name" TEXT,
  ADD COLUMN "walk_in_billing_address" TEXT,
  ADD COLUMN "walk_in_billing_city" TEXT,
  ADD COLUMN "walk_in_billing_zip_code" TEXT,
  ADD COLUMN "walk_in_billing_country" TEXT,
  ADD COLUMN "walk_in_billing_tax_number" TEXT,
  ADD COLUMN "walk_in_billing_email" TEXT;

-- =============================================================================
-- 5. Invoice modell módosítás - partnerCompanyId nullable + driverId
-- =============================================================================
ALTER TABLE "invoices"
  ALTER COLUMN "partner_company_id" DROP NOT NULL;

ALTER TABLE "invoices"
  ADD COLUMN "driver_id" TEXT;

-- Index a driver_id-hoz
CREATE INDEX "invoices_driver_id_idx" ON "invoices"("driver_id");

-- Foreign key constraint (opcionális, de ajánlott)
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "drivers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- 6. Vehicle modell módosítás - partnerCompanyId nullable
-- =============================================================================
-- Privát ügyfelek járművei partner nélkül kerülnek létrehozásra
ALTER TABLE "vehicles"
  ALTER COLUMN "partner_company_id" DROP NOT NULL;

-- =============================================================================
-- 7. DriverPartnerHistory modell módosítás - toCompanyId nullable
-- =============================================================================
-- NULL toCompanyId = sofőr privát ügyfél lett (elhagyta a partner céget)
ALTER TABLE "driver_partner_history"
  ALTER COLUMN "to_company_id" DROP NOT NULL;

-- Szükséges a foreign key constraint módosítása is (ha létezik)
ALTER TABLE "driver_partner_history"
  DROP CONSTRAINT IF EXISTS "driver_partner_history_to_company_id_fkey";

ALTER TABLE "driver_partner_history"
  ADD CONSTRAINT "driver_partner_history_to_company_id_fkey"
  FOREIGN KEY ("to_company_id") REFERENCES "partner_companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- 8. Meglévő adatok kezelése
-- =============================================================================
-- A meglévő driverek maradnak partnerrel (isPrivateCustomer = false)
-- A meglévő location-ok maradnak NETWORK_ONLY visibility-vel
-- A meglévő wash event-ek és invoice-ok megtartják a partner kapcsolatot
-- A meglévő vehicle-ök megtartják a partner kapcsolatot

-- Nincs adatvesztés, csak a constraint-ek lazítása
