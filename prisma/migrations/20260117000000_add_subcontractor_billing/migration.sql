-- Migration: Add Subcontractor Billing System
-- Description: Adds LocationPartner, LocationBillingSettings, LocationStatement, LocationInvoice tables
--              and related fields for subcontractor billing functionality

-- CreateEnum
CREATE TYPE "LocationStatementStatus" AS ENUM ('GENERATED', 'INVOICE_PENDING', 'INVOICED', 'PAID');

-- CreateEnum
CREATE TYPE "LocationInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'PAID', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "LocationInvoiceType" AS ENUM ('WALK_IN', 'PARTNER', 'NETWORK');

-- AlterTable: Add subcontractor billing fields to Location
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "subcontractor_billing_cycle" "BillingCycle";
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "subcontractor_auto_invoice_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add locationPartnerId and locationInvoiceId to WashEvent
ALTER TABLE "wash_events" ADD COLUMN IF NOT EXISTS "location_partner_id" TEXT;
ALTER TABLE "wash_events" ADD COLUMN IF NOT EXISTS "location_invoice_id" TEXT;

-- CreateTable: LocationBillingSettings
CREATE TABLE IF NOT EXISTS "location_billing_settings" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "invoice_provider" "InvoiceProvider" NOT NULL DEFAULT 'NONE',
    "szamlazz_agent_key" TEXT,
    "billingo_api_key" TEXT,
    "billingo_block_id" INTEGER,
    "billingo_bank_account_id" INTEGER,
    "nav_online_user" TEXT,
    "nav_online_password" TEXT,
    "nav_online_tax_num" TEXT,
    "nav_online_sign_key" TEXT,
    "nav_online_exch_key" TEXT,
    "seller_name" TEXT,
    "seller_address" TEXT,
    "seller_city" TEXT,
    "seller_zip_code" TEXT,
    "seller_country" TEXT NOT NULL DEFAULT 'HU',
    "seller_tax_number" TEXT,
    "seller_eu_vat_number" TEXT,
    "seller_bank_account" TEXT,
    "seller_bank_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_billing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LocationPartner
CREATE TABLE IF NOT EXISTS "location_partners" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "billing_type" "BillingType" NOT NULL DEFAULT 'CONTRACT',
    "billing_cycle" "BillingCycle",
    "billing_name" TEXT,
    "billing_address" TEXT,
    "billing_city" TEXT,
    "billing_zip_code" TEXT,
    "billing_country" TEXT DEFAULT 'HU',
    "tax_number" TEXT,
    "eu_vat_number" TEXT,
    "payment_due_days" INTEGER NOT NULL DEFAULT 8,
    "discount_threshold_1" INTEGER,
    "discount_percent_1" DOUBLE PRECISION,
    "discount_threshold_2" INTEGER,
    "discount_percent_2" DOUBLE PRECISION,
    "discount_threshold_3" INTEGER,
    "discount_percent_3" DOUBLE PRECISION,
    "discount_threshold_4" INTEGER,
    "discount_percent_4" DOUBLE PRECISION,
    "discount_threshold_5" INTEGER,
    "discount_percent_5" DOUBLE PRECISION,

    CONSTRAINT "location_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LocationStatement
CREATE TABLE IF NOT EXISTS "location_statements" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "period_label" TEXT NOT NULL,
    "wash_count" INTEGER NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'HUF',
    "status" "LocationStatementStatus" NOT NULL DEFAULT 'GENERATED',
    "invoice_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "sent_to_email" TEXT,
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LocationInvoice
CREATE TABLE IF NOT EXISTS "location_invoices" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "location_partner_id" TEXT,
    "invoice_type" "LocationInvoiceType" NOT NULL,
    "invoice_number" TEXT,
    "external_id" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "period_label" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "vat_rate" DOUBLE PRECISION NOT NULL DEFAULT 27,
    "vat_amount" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'HUF',
    "discount_percent" DOUBLE PRECISION,
    "discount_amount" DECIMAL(10,2),
    "status" "LocationInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "paid_date" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "payment_method" "PaymentMethod",
    "buyer_name" TEXT NOT NULL,
    "buyer_address" TEXT NOT NULL,
    "buyer_city" TEXT NOT NULL,
    "buyer_zip_code" TEXT NOT NULL,
    "buyer_country" TEXT NOT NULL DEFAULT 'HU',
    "buyer_tax_number" TEXT,
    "buyer_eu_vat_number" TEXT,
    "buyer_email" TEXT,
    "seller_name" TEXT NOT NULL,
    "seller_address" TEXT NOT NULL,
    "seller_city" TEXT NOT NULL,
    "seller_zip_code" TEXT NOT NULL,
    "seller_country" TEXT NOT NULL DEFAULT 'HU',
    "seller_tax_number" TEXT,
    "seller_eu_vat_number" TEXT,
    "seller_bank_account" TEXT,
    "seller_bank_name" TEXT,
    "provider_name" TEXT,
    "provider_pdf_url" TEXT,
    "provider_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LocationInvoiceItem
CREATE TABLE IF NOT EXISTS "location_invoice_items" (
    "id" TEXT NOT NULL,
    "location_invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "vat_rate" DOUBLE PRECISION NOT NULL DEFAULT 27,
    "wash_event_id" TEXT,
    "vehicle_type" "VehicleType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "location_billing_settings_location_id_key" ON "location_billing_settings"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "location_partners_location_id_code_key" ON "location_partners"("location_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "location_partners_location_id_tax_number_key" ON "location_partners"("location_id", "tax_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_partners_location_id_idx" ON "location_partners"("location_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_partners_billing_type_idx" ON "location_partners"("billing_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_partners_tax_number_idx" ON "location_partners"("tax_number");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "location_statements_invoice_id_key" ON "location_statements"("invoice_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_statements_location_id_idx" ON "location_statements"("location_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_statements_period_start_idx" ON "location_statements"("period_start");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_statements_status_idx" ON "location_statements"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "location_invoices_invoice_number_key" ON "location_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_invoices_location_id_idx" ON "location_invoices"("location_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_invoices_location_partner_id_idx" ON "location_invoices"("location_partner_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_invoices_invoice_type_idx" ON "location_invoices"("invoice_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_invoices_status_idx" ON "location_invoices"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_invoices_issue_date_idx" ON "location_invoices"("issue_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "location_invoice_items_location_invoice_id_idx" ON "location_invoice_items"("location_invoice_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wash_events_location_partner_id_idx" ON "wash_events"("location_partner_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wash_events_location_invoice_id_idx" ON "wash_events"("location_invoice_id");

-- AddForeignKey
ALTER TABLE "location_billing_settings" ADD CONSTRAINT "location_billing_settings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_partners" ADD CONSTRAINT "location_partners_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_statements" ADD CONSTRAINT "location_statements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_statements" ADD CONSTRAINT "location_statements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "location_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_invoices" ADD CONSTRAINT "location_invoices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_invoices" ADD CONSTRAINT "location_invoices_location_partner_id_fkey" FOREIGN KEY ("location_partner_id") REFERENCES "location_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_invoice_items" ADD CONSTRAINT "location_invoice_items_location_invoice_id_fkey" FOREIGN KEY ("location_invoice_id") REFERENCES "location_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_events" ADD CONSTRAINT "wash_events_location_partner_id_fkey" FOREIGN KEY ("location_partner_id") REFERENCES "location_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_events" ADD CONSTRAINT "wash_events_location_invoice_id_fkey" FOREIGN KEY ("location_invoice_id") REFERENCES "location_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
