-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- AlterTable: Add verification fields to drivers
ALTER TABLE "drivers" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "drivers" ADD COLUMN "email_verified_at" TIMESTAMP(3);
ALTER TABLE "drivers" ADD COLUMN "phone_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "drivers" ADD COLUMN "phone_verified_at" TIMESTAMP(3);

-- CreateTable: verification_tokens
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "token" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable: admin_users
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: driver_partner_history
CREATE TABLE "driver_partner_history" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "from_company_id" TEXT,
    "to_company_id" TEXT NOT NULL,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_partner_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");
CREATE INDEX "verification_tokens_network_id_idx" ON "verification_tokens"("network_id");
CREATE INDEX "verification_tokens_driver_id_idx" ON "verification_tokens"("driver_id");
CREATE INDEX "verification_tokens_token_idx" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "admin_users_network_id_idx" ON "admin_users"("network_id");
CREATE INDEX "admin_users_email_idx" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "driver_partner_history_network_id_idx" ON "driver_partner_history"("network_id");
CREATE INDEX "driver_partner_history_driver_id_idx" ON "driver_partner_history"("driver_id");

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_partner_history" ADD CONSTRAINT "driver_partner_history_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "driver_partner_history" ADD CONSTRAINT "driver_partner_history_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "driver_partner_history" ADD CONSTRAINT "driver_partner_history_from_company_id_fkey" FOREIGN KEY ("from_company_id") REFERENCES "partner_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "driver_partner_history" ADD CONSTRAINT "driver_partner_history_to_company_id_fkey" FOREIGN KEY ("to_company_id") REFERENCES "partner_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
