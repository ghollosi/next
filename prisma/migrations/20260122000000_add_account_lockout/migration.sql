-- SECURITY: Add account lockout table for persistent tracking of failed login attempts
-- This replaces the in-memory implementation to survive server restarts

-- CreateTable
CREATE TABLE "account_lockouts" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_lockouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_lockouts_identifier_key" ON "account_lockouts"("identifier");

-- CreateIndex
CREATE INDEX "account_lockouts_identifier_idx" ON "account_lockouts"("identifier");

-- CreateIndex
CREATE INDEX "account_lockouts_locked_until_idx" ON "account_lockouts"("locked_until");
