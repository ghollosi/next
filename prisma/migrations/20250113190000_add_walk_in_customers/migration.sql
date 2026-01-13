-- CreateTable
CREATE TABLE "walk_in_customers" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "walk_in_customers_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "walk_in_customer_id" TEXT;

-- CreateIndex
CREATE INDEX "walk_in_customers_network_id_idx" ON "walk_in_customers"("network_id");

-- CreateIndex
CREATE INDEX "walk_in_customers_phone_idx" ON "walk_in_customers"("phone");

-- CreateIndex
CREATE INDEX "walk_in_customers_email_idx" ON "walk_in_customers"("email");

-- CreateIndex
CREATE INDEX "bookings_walk_in_customer_id_idx" ON "bookings"("walk_in_customer_id");

-- AddForeignKey
ALTER TABLE "walk_in_customers" ADD CONSTRAINT "walk_in_customers_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_walk_in_customer_id_fkey" FOREIGN KEY ("walk_in_customer_id") REFERENCES "walk_in_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
