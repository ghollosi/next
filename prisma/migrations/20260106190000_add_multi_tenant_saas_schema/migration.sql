-- Migration: Add Multi-Tenant SaaS Schema
-- This migration adds platform-level and network-level settings for multi-tenant SaaS architecture

-- Add new enums
CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_OWNER', 'PLATFORM_ADMIN');
CREATE TYPE "NetworkRole" AS ENUM ('NETWORK_OWNER', 'NETWORK_ADMIN', 'NETWORK_CONTROLLER', 'NETWORK_ACCOUNTANT', 'LOCATION_MANAGER');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "EmailProvider" AS ENUM ('PLATFORM', 'RESEND', 'SMTP');
CREATE TYPE "SmsProvider" AS ENUM ('PLATFORM', 'TWILIO', 'NEXMO');
CREATE TYPE "InvoiceProvider" AS ENUM ('NONE', 'SZAMLAZZ', 'BILLINGO', 'NAV_ONLINE', 'MANUAL');
CREATE TYPE "ExchangeRateSource" AS ENUM ('FIXED', 'MNB', 'ECB');

-- Add subscription and localization columns to networks table
ALTER TABLE "networks" ADD COLUMN "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "networks" ADD COLUMN "trial_ends_at" TIMESTAMP(3);
ALTER TABLE "networks" ADD COLUMN "subscription_start_at" TIMESTAMP(3);
ALTER TABLE "networks" ADD COLUMN "subscription_end_at" TIMESTAMP(3);
ALTER TABLE "networks" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'HU';
ALTER TABLE "networks" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Budapest';
ALTER TABLE "networks" ADD COLUMN "default_currency" TEXT NOT NULL DEFAULT 'HUF';
ALTER TABLE "networks" ADD COLUMN "default_language" TEXT NOT NULL DEFAULT 'hu';

-- Create platform_settings table
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "platform_name" TEXT NOT NULL DEFAULT 'VSys Wash',
    "platform_url" TEXT,
    "support_email" TEXT,
    "support_phone" TEXT,
    "default_trial_days" INTEGER NOT NULL DEFAULT 14,
    "base_monthly_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "per_wash_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "email_provider" "EmailProvider" NOT NULL DEFAULT 'RESEND',
    "resend_api_key" TEXT,
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_user" TEXT,
    "smtp_password" TEXT,
    "smtp_from_email" TEXT,
    "smtp_from_name" TEXT,
    "sms_provider" "SmsProvider" NOT NULL DEFAULT 'TWILIO',
    "twilio_account_sid" TEXT,
    "twilio_auth_token" TEXT,
    "twilio_phone_number" TEXT,
    "mnb_api_enabled" BOOLEAN NOT NULL DEFAULT true,
    "ecb_api_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- Create platform_admins table
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'PLATFORM_ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- Create network_settings table
CREATE TABLE "network_settings" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "company_name" TEXT,
    "company_address" TEXT,
    "company_city" TEXT,
    "company_zip_code" TEXT,
    "company_country" TEXT NOT NULL DEFAULT 'HU',
    "tax_number" TEXT,
    "eu_vat_number" TEXT,
    "bank_account_number" TEXT,
    "bank_account_iban" TEXT,
    "bank_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "email_provider" "EmailProvider" NOT NULL DEFAULT 'PLATFORM',
    "resend_api_key" TEXT,
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_user" TEXT,
    "smtp_password" TEXT,
    "smtp_from_email" TEXT,
    "smtp_from_name" TEXT,
    "sms_provider" "SmsProvider" NOT NULL DEFAULT 'PLATFORM',
    "twilio_account_sid" TEXT,
    "twilio_auth_token" TEXT,
    "twilio_phone_number" TEXT,
    "invoice_provider" "InvoiceProvider" NOT NULL DEFAULT 'NONE',
    "szamlazz_agent_key" TEXT,
    "billingo_api_key" TEXT,
    "billingo_block_id" INTEGER,
    "nav_online_user" TEXT,
    "nav_online_password" TEXT,
    "nav_online_tax_num" TEXT,
    "nav_online_sign_key" TEXT,
    "nav_online_exch_key" TEXT,
    "allow_cash_payment" BOOLEAN NOT NULL DEFAULT true,
    "allow_card_payment" BOOLEAN NOT NULL DEFAULT true,
    "allow_fuel_cards" BOOLEAN NOT NULL DEFAULT true,
    "auto_approve_drivers" BOOLEAN NOT NULL DEFAULT false,
    "require_email_verify" BOOLEAN NOT NULL DEFAULT true,
    "require_phone_verify" BOOLEAN NOT NULL DEFAULT false,
    "allow_self_registration" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_settings_pkey" PRIMARY KEY ("id")
);

-- Create network_currencies table
CREATE TABLE "network_currencies" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL,
    "currency_name" TEXT,
    "currency_symbol" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_accepted" BOOLEAN NOT NULL DEFAULT true,
    "exchange_rate_source" "ExchangeRateSource" NOT NULL DEFAULT 'MNB',
    "fixed_exchange_rate" DECIMAL(10,4),
    "exchange_rate_margin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_exchange_rate" DECIMAL(10,4),
    "rate_updated_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_currencies_pkey" PRIMARY KEY ("id")
);

-- Create network_vat_rates table
CREATE TABLE "network_vat_rates" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "code" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_vat_rates_pkey" PRIMARY KEY ("id")
);

-- Create network_brandings table
CREATE TABLE "network_brandings" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#3B82F6',
    "secondary_color" TEXT NOT NULL DEFAULT '#10B981',
    "accent_color" TEXT NOT NULL DEFAULT '#F59E0B',
    "app_name" TEXT,
    "welcome_message" TEXT,
    "footer_text" TEXT,
    "custom_domain" TEXT,
    "ssl_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ssl_certificate_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_brandings_pkey" PRIMARY KEY ("id")
);

-- Create network_admins table
CREATE TABLE "network_admins" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "NetworkRole" NOT NULL DEFAULT 'NETWORK_ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "allowed_location_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_admins_pkey" PRIMARY KEY ("id")
);

-- Create usage_logs table
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "wash_count" INTEGER NOT NULL DEFAULT 0,
    "driver_count" INTEGER NOT NULL DEFAULT 0,
    "location_count" INTEGER NOT NULL DEFAULT 0,
    "base_fee_due" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "wash_fee_due" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_due" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),
    "invoice_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- Create exchange_rate_cache table
CREATE TABLE "exchange_rate_cache" (
    "id" TEXT NOT NULL,
    "source_currency" TEXT NOT NULL,
    "target_currency" TEXT NOT NULL,
    "rate" DECIMAL(10,6) NOT NULL,
    "source" "ExchangeRateSource" NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rate_cache_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");
CREATE UNIQUE INDEX "network_settings_network_id_key" ON "network_settings"("network_id");
CREATE UNIQUE INDEX "network_currencies_network_id_currency_code_key" ON "network_currencies"("network_id", "currency_code");
CREATE UNIQUE INDEX "network_brandings_network_id_key" ON "network_brandings"("network_id");
CREATE UNIQUE INDEX "network_brandings_custom_domain_key" ON "network_brandings"("custom_domain");
CREATE UNIQUE INDEX "network_admins_network_id_email_key" ON "network_admins"("network_id", "email");
CREATE UNIQUE INDEX "exchange_rate_cache_source_currency_target_currency_source_key" ON "exchange_rate_cache"("source_currency", "target_currency", "source");

-- Create indexes
CREATE INDEX "network_currencies_network_id_idx" ON "network_currencies"("network_id");
CREATE INDEX "network_vat_rates_network_id_idx" ON "network_vat_rates"("network_id");
CREATE INDEX "network_admins_network_id_idx" ON "network_admins"("network_id");
CREATE INDEX "network_admins_email_idx" ON "network_admins"("email");
CREATE INDEX "usage_logs_network_id_idx" ON "usage_logs"("network_id");
CREATE INDEX "usage_logs_period_start_idx" ON "usage_logs"("period_start");
CREATE INDEX "exchange_rate_cache_fetched_at_idx" ON "exchange_rate_cache"("fetched_at");

-- Add foreign keys
ALTER TABLE "network_settings" ADD CONSTRAINT "network_settings_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "network_currencies" ADD CONSTRAINT "network_currencies_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "network_vat_rates" ADD CONSTRAINT "network_vat_rates_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "network_brandings" ADD CONSTRAINT "network_brandings_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "network_admins" ADD CONSTRAINT "network_admins_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default platform settings
INSERT INTO "platform_settings" ("id", "platform_name", "updated_at")
VALUES (gen_random_uuid(), 'VSys Wash', CURRENT_TIMESTAMP);

-- Set trial end date for existing networks (14 days from now)
UPDATE "networks" SET "trial_ends_at" = CURRENT_TIMESTAMP + INTERVAL '14 days' WHERE "trial_ends_at" IS NULL;
