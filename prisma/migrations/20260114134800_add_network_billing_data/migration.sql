-- AlterTable
ALTER TABLE "networks" ADD COLUMN "billing_company_name" TEXT;
ALTER TABLE "networks" ADD COLUMN "billing_address" TEXT;
ALTER TABLE "networks" ADD COLUMN "billing_city" TEXT;
ALTER TABLE "networks" ADD COLUMN "billing_zip_code" TEXT;
ALTER TABLE "networks" ADD COLUMN "billing_country" TEXT NOT NULL DEFAULT 'HU';
ALTER TABLE "networks" ADD COLUMN "billing_tax_number" TEXT;
ALTER TABLE "networks" ADD COLUMN "billing_eu_vat_number" TEXT;
ALTER TABLE "networks" ADD COLUMN "billing_email" TEXT;
