-- Platform szintű cégadatbázis szolgáltatás
-- Platform központi API kulcsokkal szolgáltat a Network-öknek
-- Network-ök csak akkor állíthatnak be sajátot, ha a Platform engedélyezi

-- Add platform-level company data fields
ALTER TABLE "platform_settings"
ADD COLUMN IF NOT EXISTS "company_data_provider" "CompanyDataProvider" NOT NULL DEFAULT 'NONE'::"CompanyDataProvider",
ADD COLUMN IF NOT EXISTS "opten_api_key" TEXT,
ADD COLUMN IF NOT EXISTS "opten_api_secret" TEXT,
ADD COLUMN IF NOT EXISTS "bisnode_api_key" TEXT,
ADD COLUMN IF NOT EXISTS "bisnode_api_secret" TEXT,
ADD COLUMN IF NOT EXISTS "company_data_monthly_fee" DECIMAL(10, 2);

-- Add network-level permission flag
ALTER TABLE "network_settings"
ADD COLUMN IF NOT EXISTS "allow_custom_company_data_provider" BOOLEAN NOT NULL DEFAULT false;
