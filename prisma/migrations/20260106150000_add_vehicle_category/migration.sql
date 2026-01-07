-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('SOLO', 'TRACTOR', 'TRAILER');

-- AlterTable: Add category column with default
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "category" "VehicleCategory" NOT NULL DEFAULT 'SOLO';

-- AlterTable: Add nickname column
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "nickname" TEXT;

-- AlterTable: Rename model to model_name (if exists)
ALTER TABLE "vehicles" RENAME COLUMN "model" TO "model_name";

-- AlterTable: Drop old type column (no longer needed - category replaces it)
ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "type";

-- AlterTable: Drop plate_state from unique constraint
ALTER TABLE "vehicles" DROP CONSTRAINT IF EXISTS "vehicles_network_id_plate_number_plate_state_key";

-- CreateIndex: New unique constraint without plate_state
CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_network_id_plate_number_key" ON "vehicles"("network_id", "plate_number");

-- CreateIndex: Category index
CREATE INDEX IF NOT EXISTS "vehicles_category_idx" ON "vehicles"("category");
