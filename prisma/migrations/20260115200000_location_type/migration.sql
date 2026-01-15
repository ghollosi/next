-- CreateEnum: LocationType (Autómosó vs Kamionmosó)
CREATE TYPE "LocationType" AS ENUM ('CAR_WASH', 'TRUCK_WASH');

-- AlterTable: Add location_type column with default TRUCK_WASH (existing locations are truck washes)
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "location_type" "LocationType" NOT NULL DEFAULT 'TRUCK_WASH';

-- Add index for filtering by location type
CREATE INDEX IF NOT EXISTS "locations_location_type_idx" ON "locations"("location_type");
