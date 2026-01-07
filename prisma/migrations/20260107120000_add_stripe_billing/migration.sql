-- Add Stripe fields to networks table
ALTER TABLE "networks" ADD COLUMN "stripe_customer_id" TEXT;
ALTER TABLE "networks" ADD COLUMN "stripe_subscription_id" TEXT;
ALTER TABLE "networks" ADD COLUMN "stripe_payment_method_id" TEXT;
ALTER TABLE "networks" ADD COLUMN "last_payment_status" TEXT;
ALTER TABLE "networks" ADD COLUMN "last_payment_date" TIMESTAMP(3);
ALTER TABLE "networks" ADD COLUMN "payment_failed_at" TIMESTAMP(3);
ALTER TABLE "networks" ADD COLUMN "payment_retry_count" INTEGER NOT NULL DEFAULT 0;

-- Add unique constraints
CREATE UNIQUE INDEX "networks_stripe_customer_id_key" ON "networks"("stripe_customer_id");
CREATE UNIQUE INDEX "networks_stripe_subscription_id_key" ON "networks"("stripe_subscription_id");

-- Add Stripe configuration to platform_settings
ALTER TABLE "platform_settings" ADD COLUMN "stripe_secret_key" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "stripe_publishable_key" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "stripe_webhook_secret" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "stripe_product_id" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "stripe_base_price_id" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "stripe_usage_price_id" TEXT;
