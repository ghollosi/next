-- Add security fields to platform_admins table
ALTER TABLE "platform_admins" ADD COLUMN "recovery_email" TEXT;
ALTER TABLE "platform_admins" ADD COLUMN "password_reset_token" TEXT;
ALTER TABLE "platform_admins" ADD COLUMN "password_reset_expires" TIMESTAMP(3);
ALTER TABLE "platform_admins" ADD COLUMN "emergency_token" TEXT;
ALTER TABLE "platform_admins" ADD COLUMN "emergency_token_expires" TIMESTAMP(3);

-- Add unique constraints for tokens
CREATE UNIQUE INDEX "platform_admins_password_reset_token_key" ON "platform_admins"("password_reset_token");
CREATE UNIQUE INDEX "platform_admins_emergency_token_key" ON "platform_admins"("emergency_token");
