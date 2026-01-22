-- AlterTable: Make pin_hash optional (email+password auth transition)
ALTER TABLE "drivers" ALTER COLUMN "pin_hash" DROP NOT NULL;
