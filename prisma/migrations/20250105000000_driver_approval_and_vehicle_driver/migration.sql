-- CreateEnum
CREATE TYPE "DriverApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable - Driver approval fields
ALTER TABLE "drivers" ADD COLUMN "approval_status" "DriverApprovalStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "approved_by_user_id" TEXT,
ADD COLUMN "rejection_reason" TEXT;

-- CreateIndex
CREATE INDEX "drivers_approval_status_idx" ON "drivers"("approval_status");

-- AlterTable - Vehicle driver relation
ALTER TABLE "vehicles" ADD COLUMN "driver_id" TEXT;

-- CreateIndex
CREATE INDEX "vehicles_driver_id_idx" ON "vehicles"("driver_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
