-- Update VehicleType enum with complete list from user's price table
-- This migration replaces the old vehicle types with the correct ones

-- First, we need to add all new values to the enum
-- PostgreSQL enums can only have values added, not removed directly

-- Add new vehicle type values
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'SEMI_TRUCK';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'GRAIN_CARRIER';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TRAILER_ONLY';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'CONTAINER_CARRIER';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TRUCK_1_5T';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TRUCK_3_5T';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TRUCK_7_5T';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TRUCK_12T_PLUS';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TANK_SOLO';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TANK_12T';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TANK_TRUCK';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TANK_SEMI_TRAILER';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TANDEM_7_5T';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TANDEM_7_5T_PLUS';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'SILO_TANDEM';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TIPPER_MIXER';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'CAR_CARRIER';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'MINIBUS';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'MIDIBUS';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'SUV_MPV';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'MACHINERY';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'FORKLIFT';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'MOTORCYCLE';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'BUILDING_PARTS';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'CHILD_SEAT';

-- Note: Old values (SOLO_SMALL, SOLO_LARGE, etc.) remain in the enum
-- but won't be used going forward. If there are existing records with
-- old vehicle types, they should be migrated to new types as needed.
