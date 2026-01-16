-- Add e-Cégjegyzék API key to PlatformSettings
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "e_cegjegyzek_api_key" TEXT;

-- Add e-Cégjegyzék API key to NetworkSettings
ALTER TABLE "network_settings" ADD COLUMN IF NOT EXISTS "e_cegjegyzek_api_key" TEXT;
