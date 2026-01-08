-- Add pinHash field to partner_companies table for secure authentication
ALTER TABLE "partner_companies" ADD COLUMN "pin_hash" TEXT;
