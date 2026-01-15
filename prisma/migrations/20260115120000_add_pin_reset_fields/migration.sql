-- Add PIN reset fields to location_operators table
ALTER TABLE "location_operators" ADD COLUMN IF NOT EXISTS "pin_reset_token" TEXT;
ALTER TABLE "location_operators" ADD COLUMN IF NOT EXISTS "pin_reset_expires" TIMESTAMP(3);

-- Add PIN reset fields to partner_companies table
ALTER TABLE "partner_companies" ADD COLUMN IF NOT EXISTS "pin_reset_token" TEXT;
ALTER TABLE "partner_companies" ADD COLUMN IF NOT EXISTS "pin_reset_expires" TIMESTAMP(3);
