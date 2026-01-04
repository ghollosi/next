-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('CONTRACT', 'CASH');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'WEEKLY');

-- AlterTable
ALTER TABLE "partner_companies" ADD COLUMN     "billing_address" TEXT,
ADD COLUMN     "billing_city" TEXT,
ADD COLUMN     "billing_country" TEXT DEFAULT 'HU',
ADD COLUMN     "billing_cycle" "BillingCycle",
ADD COLUMN     "billing_name" TEXT,
ADD COLUMN     "billing_type" "BillingType" NOT NULL DEFAULT 'CONTRACT',
ADD COLUMN     "billing_zip_code" TEXT,
ADD COLUMN     "eu_vat_number" TEXT,
ADD COLUMN     "tax_number" TEXT;
