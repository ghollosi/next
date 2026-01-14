-- AlterTable NetworkSettings - add Billingo bank account ID
ALTER TABLE "network_settings" ADD COLUMN IF NOT EXISTS "billingo_bank_account_id" INTEGER;

-- AlterTable PlatformSettings - add Billingo bank account ID
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "billingo_bank_account_id" INTEGER;
