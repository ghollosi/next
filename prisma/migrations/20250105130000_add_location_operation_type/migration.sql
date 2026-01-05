-- Add OperationType enum
CREATE TYPE "OperationType" AS ENUM ('OWN', 'SUBCONTRACTOR');

-- Add new columns to locations table
ALTER TABLE "locations" ADD COLUMN "operation_type" "OperationType" NOT NULL DEFAULT 'OWN';
ALTER TABLE "locations" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "locations" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "locations" ADD COLUMN "opening_hours" TEXT;

-- Update default values for Hungarian context
ALTER TABLE "locations" ALTER COLUMN "country" SET DEFAULT 'HU';
ALTER TABLE "locations" ALTER COLUMN "timezone" SET DEFAULT 'Europe/Budapest';

-- Create index on operation_type
CREATE INDEX "locations_operation_type_idx" ON "locations"("operation_type");

-- Delete existing demo locations if any
DELETE FROM "locations" WHERE network_id = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

-- Seed 6 OWN-operated locations
INSERT INTO "locations" (id, network_id, name, code, address, city, zip_code, country, timezone, "isActive", operation_type, latitude, longitude, opening_hours, "createdAt", "updatedAt")
VALUES
  -- Mosonmagyaróvár
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Mosonmagyaróvár', 'MMOVAR', 'Ipartelep út 15.', 'Mosonmagyaróvár', '9200', 'HU', 'Europe/Budapest', true, 'OWN', 47.8725, 17.2693, 'H-P: 06:00-22:00, Szo-V: 07:00-20:00', NOW(), NOW()),
  -- Győr 1
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Győr 1', 'GYOR1', 'Fehérvári út 75.', 'Győr', '9027', 'HU', 'Europe/Budapest', true, 'OWN', 47.6875, 17.6504, 'H-V: 00:00-24:00', NOW(), NOW()),
  -- Győr 2
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Győr 2', 'GYOR2', 'Külső-Veszprémi út 12.', 'Győr', '9024', 'HU', 'Europe/Budapest', true, 'OWN', 47.6629, 17.6261, 'H-V: 00:00-24:00', NOW(), NOW()),
  -- BILK (Budapest)
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'BILK Budapest', 'BILK', 'Csepeli átjáró 4.', 'Budapest', '1211', 'HU', 'Europe/Budapest', true, 'OWN', 47.4213, 19.0716, 'H-V: 00:00-24:00', NOW(), NOW()),
  -- Nagykőrösi út (Budapest)
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Nagykőrösi út', 'NKOROSI', 'Nagykőrösi út 351.', 'Budapest', '1239', 'HU', 'Europe/Budapest', true, 'OWN', 47.4089, 19.1502, 'H-V: 00:00-24:00', NOW(), NOW()),
  -- A2 (M1 autópálya)
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'A2 Pihenő', 'A2', 'M1 autópálya, A2 pihenő', 'Tatabánya', '2800', 'HU', 'Europe/Budapest', true, 'OWN', 47.5691, 18.3921, 'H-V: 00:00-24:00', NOW(), NOW());

-- Seed 14 SUBCONTRACTOR locations
INSERT INTO "locations" (id, network_id, name, code, address, city, zip_code, country, timezone, "isActive", operation_type, latitude, longitude, opening_hours, "createdAt", "updatedAt")
VALUES
  -- Szekszárd
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Szekszárd', 'SZEKSZ', 'Ipari park 8.', 'Szekszárd', '7100', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 46.3474, 18.7085, 'H-P: 06:00-18:00', NOW(), NOW()),
  -- Bóly
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Bóly', 'BOLY', 'Kossuth u. 45.', 'Bóly', '7754', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 45.9667, 18.5167, 'H-P: 07:00-17:00', NOW(), NOW()),
  -- Pécs
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Pécs', 'PECS1', 'Megyeri út 76.', 'Pécs', '7632', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 46.0727, 18.2323, 'H-Szo: 06:00-20:00', NOW(), NOW()),
  -- Pécs 2
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Pécs 2', 'PECS2', 'Siklósi út 104.', 'Pécs', '7636', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 46.0491, 18.2089, 'H-P: 07:00-19:00', NOW(), NOW()),
  -- Polgár
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Polgár', 'POLGAR', 'M3 ipari park', 'Polgár', '4090', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 47.8667, 21.1167, 'H-V: 00:00-24:00', NOW(), NOW()),
  -- Székesfehérvár
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Székesfehérvár', 'SZFVAR1', 'Seregélyesi út 96.', 'Székesfehérvár', '8000', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 47.1860, 18.4225, 'H-V: 05:00-22:00', NOW(), NOW()),
  -- Székesfehérvár 2
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Székesfehérvár 2', 'SZFVAR2', 'Börgöndi út 22.', 'Székesfehérvár', '8000', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 47.1950, 18.4102, 'H-P: 06:00-18:00', NOW(), NOW()),
  -- Miskolc
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Miskolc', 'MISKOLC', 'Vágóhíd u. 5.', 'Miskolc', '3527', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 48.1035, 20.7784, 'H-Szo: 06:00-20:00', NOW(), NOW()),
  -- Debrecen
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Debrecen', 'DEBRECEN', 'Epreskert u. 32.', 'Debrecen', '4030', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 47.5316, 21.6273, 'H-V: 00:00-24:00', NOW(), NOW()),
  -- Nyíregyháza
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Nyíregyháza', 'NYIREGYHAZA', 'Debreceni út 62.', 'Nyíregyháza', '4400', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 47.9495, 21.7244, 'H-P: 06:00-20:00, Szo: 07:00-14:00', NOW(), NOW()),
  -- Kiskunfélegyháza
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Kiskunfélegyháza', 'KFHAZA', 'Szegedi út 88.', 'Kiskunfélegyháza', '6100', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 46.7098, 19.8506, 'H-P: 07:00-17:00', NOW(), NOW()),
  -- Kecskemét
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Kecskemét', 'KECSKEMET', 'Matkói út 4.', 'Kecskemét', '6000', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 46.9062, 19.6913, 'H-V: 05:00-22:00', NOW(), NOW()),
  -- Szombathely
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Szombathely', 'SZOMBATHELY', 'Zanati út 18.', 'Szombathely', '9700', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 47.2307, 16.6218, 'H-P: 06:00-18:00, Szo: 07:00-12:00', NOW(), NOW()),
  -- Veszprém
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Veszprém', 'VESZPREM', 'Házgyári út 1.', 'Veszprém', '8200', 'HU', 'Europe/Budapest', true, 'SUBCONTRACTOR', 47.0930, 17.9093, 'H-P: 06:00-20:00', NOW(), NOW());
