-- CreateTable
CREATE TABLE "location_operators" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "location_operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wash_delete_requests" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "wash_event_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wash_delete_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_operators_network_id_idx" ON "location_operators"("network_id");

-- CreateIndex
CREATE INDEX "location_operators_location_id_idx" ON "location_operators"("location_id");

-- CreateIndex
CREATE INDEX "wash_delete_requests_network_id_idx" ON "wash_delete_requests"("network_id");

-- CreateIndex
CREATE INDEX "wash_delete_requests_wash_event_id_idx" ON "wash_delete_requests"("wash_event_id");

-- CreateIndex
CREATE INDEX "wash_delete_requests_status_idx" ON "wash_delete_requests"("status");

-- AddForeignKey
ALTER TABLE "location_operators" ADD CONSTRAINT "location_operators_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_operators" ADD CONSTRAINT "location_operators_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_delete_requests" ADD CONSTRAINT "wash_delete_requests_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_delete_requests" ADD CONSTRAINT "wash_delete_requests_wash_event_id_fkey" FOREIGN KEY ("wash_event_id") REFERENCES "wash_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update existing network_settings to have autoApproveDrivers = true
UPDATE "network_settings" SET "auto_approve_drivers" = true WHERE "auto_approve_drivers" = false;
