-- AlterTable: Add PaymentMethod and InvoiceStatus enums
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'DKV', 'UTA', 'MOL', 'SHELL', 'TRAVIS', 'OTHER');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'PAID', 'CANCELLED', 'OVERDUE');

-- AlterTable: Add new fields to partner_companies
ALTER TABLE "partner_companies" ADD COLUMN "payment_due_days" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "partner_companies" ADD COLUMN "discount_percent" DOUBLE PRECISION;
ALTER TABLE "partner_companies" ADD COLUMN "discount_threshold_1" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "discount_percent_1" DOUBLE PRECISION;
ALTER TABLE "partner_companies" ADD COLUMN "discount_threshold_2" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "discount_percent_2" DOUBLE PRECISION;

-- AlterTable: Add pricing and payment fields to wash_events
ALTER TABLE "wash_events" ADD COLUMN "tractor_price" DECIMAL(10,2);
ALTER TABLE "wash_events" ADD COLUMN "trailer_price" DECIMAL(10,2);
ALTER TABLE "wash_events" ADD COLUMN "total_price" DECIMAL(10,2);
ALTER TABLE "wash_events" ADD COLUMN "discount_percent" DOUBLE PRECISION;
ALTER TABLE "wash_events" ADD COLUMN "discount_amount" DECIMAL(10,2);
ALTER TABLE "wash_events" ADD COLUMN "final_price" DECIMAL(10,2);
ALTER TABLE "wash_events" ADD COLUMN "payment_method" "PaymentMethod";
ALTER TABLE "wash_events" ADD COLUMN "paid_at" TIMESTAMP(3);
ALTER TABLE "wash_events" ADD COLUMN "invoice_id" TEXT;

-- CreateTable: service_prices
CREATE TABLE "service_prices" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "service_package_id" TEXT NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'HUF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: partner_custom_prices
CREATE TABLE "partner_custom_prices" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "partner_company_id" TEXT NOT NULL,
    "service_package_id" TEXT NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'HUF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_custom_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: invoices
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "partner_company_id" TEXT NOT NULL,
    "invoice_number" TEXT,
    "external_id" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "vat_rate" DOUBLE PRECISION NOT NULL DEFAULT 27,
    "vat_amount" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'HUF',
    "discount_percent" DOUBLE PRECISION,
    "discount_amount" DECIMAL(10,2),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "paid_date" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "payment_method" "PaymentMethod",
    "billing_name" TEXT NOT NULL,
    "billing_address" TEXT NOT NULL,
    "billing_city" TEXT NOT NULL,
    "billing_zip_code" TEXT NOT NULL,
    "billing_country" TEXT NOT NULL DEFAULT 'HU',
    "tax_number" TEXT,
    "eu_vat_number" TEXT,
    "szamlazz_pdf_url" TEXT,
    "szamlazz_response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: invoice_items
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "vat_rate" DOUBLE PRECISION NOT NULL DEFAULT 27,
    "wash_event_id" TEXT,
    "service_package_id" TEXT,
    "vehicle_type" "VehicleType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_prices_network_id_service_package_id_vehicle_type_key" ON "service_prices"("network_id", "service_package_id", "vehicle_type");
CREATE INDEX "service_prices_network_id_idx" ON "service_prices"("network_id");
CREATE INDEX "service_prices_service_package_id_idx" ON "service_prices"("service_package_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_custom_prices_partner_company_id_service_package_id_key" ON "partner_custom_prices"("partner_company_id", "service_package_id", "vehicle_type");
CREATE INDEX "partner_custom_prices_network_id_idx" ON "partner_custom_prices"("network_id");
CREATE INDEX "partner_custom_prices_partner_company_id_idx" ON "partner_custom_prices"("partner_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE INDEX "invoices_network_id_idx" ON "invoices"("network_id");
CREATE INDEX "invoices_partner_company_id_idx" ON "invoices"("partner_company_id");
CREATE INDEX "invoices_status_idx" ON "invoices"("status");
CREATE INDEX "invoices_issue_date_idx" ON "invoices"("issue_date");
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");
CREATE INDEX "wash_events_invoice_id_idx" ON "wash_events"("invoice_id");

-- AddForeignKey
ALTER TABLE "service_prices" ADD CONSTRAINT "service_prices_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_prices" ADD CONSTRAINT "service_prices_service_package_id_fkey" FOREIGN KEY ("service_package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_custom_prices" ADD CONSTRAINT "partner_custom_prices_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "partner_custom_prices" ADD CONSTRAINT "partner_custom_prices_partner_company_id_fkey" FOREIGN KEY ("partner_company_id") REFERENCES "partner_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "partner_custom_prices" ADD CONSTRAINT "partner_custom_prices_service_package_id_fkey" FOREIGN KEY ("service_package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_partner_company_id_fkey" FOREIGN KEY ("partner_company_id") REFERENCES "partner_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_service_package_id_fkey" FOREIGN KEY ("service_package_id") REFERENCES "service_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_events" ADD CONSTRAINT "wash_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
