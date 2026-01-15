-- Create driver_pin_reset_requests table
CREATE TABLE IF NOT EXISTS "driver_pin_reset_requests" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "partner_company_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_pin_reset_requests_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "driver_pin_reset_requests_network_id_idx" ON "driver_pin_reset_requests"("network_id");
CREATE INDEX IF NOT EXISTS "driver_pin_reset_requests_driver_id_idx" ON "driver_pin_reset_requests"("driver_id");
CREATE INDEX IF NOT EXISTS "driver_pin_reset_requests_partner_company_id_idx" ON "driver_pin_reset_requests"("partner_company_id");
CREATE INDEX IF NOT EXISTS "driver_pin_reset_requests_status_idx" ON "driver_pin_reset_requests"("status");

-- Add foreign keys
ALTER TABLE "driver_pin_reset_requests" ADD CONSTRAINT "driver_pin_reset_requests_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "driver_pin_reset_requests" ADD CONSTRAINT "driver_pin_reset_requests_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "driver_pin_reset_requests" ADD CONSTRAINT "driver_pin_reset_requests_partner_company_id_fkey" FOREIGN KEY ("partner_company_id") REFERENCES "partner_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
