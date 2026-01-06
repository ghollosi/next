-- CreateTable
CREATE TABLE "wash_event_services" (
    "id" TEXT NOT NULL,
    "wash_event_id" TEXT NOT NULL,
    "service_package_id" TEXT NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_price" DECIMAL(10,2) NOT NULL,
    "vehicle_role" TEXT,
    "plate_number" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wash_event_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wash_event_services_wash_event_id_idx" ON "wash_event_services"("wash_event_id");

-- CreateIndex
CREATE INDEX "wash_event_services_service_package_id_idx" ON "wash_event_services"("service_package_id");

-- AddForeignKey
ALTER TABLE "wash_event_services" ADD CONSTRAINT "wash_event_services_wash_event_id_fkey" FOREIGN KEY ("wash_event_id") REFERENCES "wash_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_event_services" ADD CONSTRAINT "wash_event_services_service_package_id_fkey" FOREIGN KEY ("service_package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable - Make servicePackageId optional
ALTER TABLE "wash_events" ALTER COLUMN "service_package_id" DROP NOT NULL;
