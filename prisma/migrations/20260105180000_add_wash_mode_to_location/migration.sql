-- CreateEnum
CREATE TYPE "WashMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- AlterTable
ALTER TABLE "locations" ADD COLUMN "wash_mode" "WashMode" NOT NULL DEFAULT 'MANUAL';
