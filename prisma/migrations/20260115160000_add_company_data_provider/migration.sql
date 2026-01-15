-- Create CompanyDataProvider enum type
DO $$ BEGIN
    CREATE TYPE "CompanyDataProvider" AS ENUM ('NONE', 'OPTEN', 'BISNODE', 'E_CEGJEGYZEK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add company data provider fields to network_settings table
ALTER TABLE "network_settings"
ADD COLUMN IF NOT EXISTS "company_data_provider" "CompanyDataProvider" NOT NULL DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "opten_api_key" TEXT,
ADD COLUMN IF NOT EXISTS "opten_api_secret" TEXT,
ADD COLUMN IF NOT EXISTS "bisnode_api_key" TEXT,
ADD COLUMN IF NOT EXISTS "bisnode_api_secret" TEXT;
