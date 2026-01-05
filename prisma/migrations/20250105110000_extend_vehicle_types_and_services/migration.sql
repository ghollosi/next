-- Extend VehicleType enum with new values
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'SOLO_SMALL';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'SOLO_LARGE';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TRAILER_SMALL';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TRAILER_LARGE';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'SEMI_TRAILER';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'SEMI_TRAILER_REFRIGERATED';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'SEMI_TRAILER_TARPAULIN';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'SEMI_TRAILER_FLATBED';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TIPPER';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'CRANE_TRUCK';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TANK';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'SILO';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'CONTAINER';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'WASTE_CARRIER';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'BUS';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'AGRICULTURAL';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'CAR';

-- Ensure the demo network exists
INSERT INTO "networks" (id, name, slug, "isActive", "createdAt", "updatedAt")
VALUES ('cf808392-6283-4487-9fbd-e72951ca5bf8', 'vSys Demo Network', 'vsys-demo', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert service packages (mosástípusok)
-- Using the demo network ID: cf808392-6283-4487-9fbd-e72951ca5bf8

-- Kézi mosás típusok
INSERT INTO "service_packages" (id, network_id, name, code, description, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Kézi külső mosás', 'MANUAL_EXT', 'Kézi külső mosás', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Kézi belső takarítás', 'MANUAL_INT', 'Kézi belső takarítás', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Kézi külső + belső', 'MANUAL_FULL', 'Kézi külső mosás + belső takarítás', true, NOW(), NOW())
ON CONFLICT (network_id, code) DO NOTHING;

-- Gépi mosás típusok
INSERT INTO "service_packages" (id, network_id, name, code, description, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Gépi külső mosás', 'MACHINE_EXT', 'Gépi külső mosás', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Gépi belső takarítás', 'MACHINE_INT', 'Gépi belső takarítás', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Gépi külső + belső', 'MACHINE_FULL', 'Gépi külső mosás + belső takarítás', true, NOW(), NOW())
ON CONFLICT (network_id, code) DO NOTHING;

-- Speciális szolgáltatások
INSERT INTO "service_packages" (id, network_id, name, code, description, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'ADR takarítás', 'ADR', 'ADR (veszélyes anyag) takarítás', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Tartálymosás kézi', 'TANK_MANUAL', 'Tartálymosás kézi', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Tartálymosás gépi', 'TANK_MACHINE', 'Tartálymosás gépi', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Tartálymosás vegyszerezés', 'TANK_CHEMICAL', 'Tartálymosás vegyszerezéssel', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Hulladékszállító takarítás', 'WASTE_CLEAN', 'Hulladékszállító jármű takarítás', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Motor/alvázmosás', 'ENGINE_CHASSIS', 'Motor és alvázmosás', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Hűtőegység mosás', 'REFRIGERATOR', 'Hűtőegység mosás', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Ponyvás pótkocsi tetőmosás', 'TARPAULIN_ROOF', 'Ponyvás pótkocsi tetőmosás', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Platós pótkocsi tetőmosás', 'FLATBED_ROOF', 'Platós pótkocsi tetőmosás', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Zsírozás kézi', 'GREASE_MANUAL', 'Zsírozás kézi', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Zsírozás gépi', 'GREASE_MACHINE', 'Zsírozás gépi', true, NOW(), NOW()),
  (gen_random_uuid(), 'cf808392-6283-4487-9fbd-e72951ca5bf8', 'Hűtős állati szállítás takarítás', 'ANIMAL_REFRIGERATED', 'Hűtős félpótkocsi állati szállítás utáni takarítás', true, NOW(), NOW())
ON CONFLICT (network_id, code) DO NOTHING;
