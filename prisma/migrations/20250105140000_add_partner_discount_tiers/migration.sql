-- Kedvezmény mezők bővítése: 5 szint saját + 5 szint alvállalkozói hálózatra

-- Régi mezők törlése
ALTER TABLE "partner_companies" DROP COLUMN IF EXISTS "discount_percent";
ALTER TABLE "partner_companies" DROP COLUMN IF EXISTS "discount_threshold_1";
ALTER TABLE "partner_companies" DROP COLUMN IF EXISTS "discount_percent_1";
ALTER TABLE "partner_companies" DROP COLUMN IF EXISTS "discount_threshold_2";
ALTER TABLE "partner_companies" DROP COLUMN IF EXISTS "discount_percent_2";

-- SAJÁT hálózat kedvezmény szintek (5 db)
ALTER TABLE "partner_companies" ADD COLUMN "own_discount_threshold_1" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "own_discount_percent_1" DOUBLE PRECISION;
ALTER TABLE "partner_companies" ADD COLUMN "own_discount_threshold_2" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "own_discount_percent_2" DOUBLE PRECISION;
ALTER TABLE "partner_companies" ADD COLUMN "own_discount_threshold_3" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "own_discount_percent_3" DOUBLE PRECISION;
ALTER TABLE "partner_companies" ADD COLUMN "own_discount_threshold_4" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "own_discount_percent_4" DOUBLE PRECISION;
ALTER TABLE "partner_companies" ADD COLUMN "own_discount_threshold_5" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "own_discount_percent_5" DOUBLE PRECISION;

-- ALVÁLLALKOZÓI hálózat kedvezmény szintek (5 db)
ALTER TABLE "partner_companies" ADD COLUMN "sub_discount_threshold_1" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "sub_discount_percent_1" DOUBLE PRECISION;
ALTER TABLE "partner_companies" ADD COLUMN "sub_discount_threshold_2" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "sub_discount_percent_2" DOUBLE PRECISION;
ALTER TABLE "partner_companies" ADD COLUMN "sub_discount_threshold_3" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "sub_discount_percent_3" DOUBLE PRECISION;
ALTER TABLE "partner_companies" ADD COLUMN "sub_discount_threshold_4" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "sub_discount_percent_4" DOUBLE PRECISION;
ALTER TABLE "partner_companies" ADD COLUMN "sub_discount_threshold_5" INTEGER;
ALTER TABLE "partner_companies" ADD COLUMN "sub_discount_percent_5" DOUBLE PRECISION;
