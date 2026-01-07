-- Network egyedi árazás hozzáadása
-- Lehetővé teszi, hogy minden network-nek egyedi havi díja és mosásonkénti díja legyen

-- Egyedi árazás mezők hozzáadása a networks táblához
ALTER TABLE "networks" ADD COLUMN "custom_monthly_fee" DECIMAL(10,2);
ALTER TABLE "networks" ADD COLUMN "custom_per_wash_fee" DECIMAL(10,2);
ALTER TABLE "networks" ADD COLUMN "pricing_notes" TEXT;

-- Ha NULL, akkor a platform alapértelmezett árazás érvényes
-- Ha ki van töltve, akkor az egyedi árazás érvényes
