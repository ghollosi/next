#!/bin/bash
# Deploy script for VSys Next - Run this on the server
# Feature: Independent Customer & Location Visibility

echo "=== VSys Next Deploy Script ==="
echo "Feature: Independent Customer & Location Visibility"
echo ""

# Navigate to project directory
cd /home/vsys/vsys-next

# Pull latest changes
echo "1. Pulling latest code..."
git pull origin master

# Run database migration
echo ""
echo "2. Running database migration..."

# 2.1 Create LocationVisibility enum
echo "   2.1 Creating LocationVisibility enum..."
psql -U vsys -d vsys_next -c "DO \$\$ BEGIN CREATE TYPE \"LocationVisibility\" AS ENUM ('PUBLIC', 'NETWORK_ONLY', 'DEDICATED'); EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;"

# 2.2 Driver.partnerCompanyId nullable
echo "   2.2 Making Driver.partnerCompanyId nullable..."
psql -U vsys -d vsys_next -c "ALTER TABLE drivers ALTER COLUMN partner_company_id DROP NOT NULL;" 2>/dev/null || true

# 2.3 Location visibility fields
echo "   2.3 Adding Location visibility fields..."
psql -U vsys -d vsys_next -c "ALTER TABLE locations ADD COLUMN IF NOT EXISTS visibility \"LocationVisibility\" NOT NULL DEFAULT 'NETWORK_ONLY';"
psql -U vsys -d vsys_next -c "ALTER TABLE locations ADD COLUMN IF NOT EXISTS dedicated_partner_ids TEXT[] DEFAULT '{}';"

# 2.4 WashEvent.partnerCompanyId nullable + walk-in fields
echo "   2.4 Making WashEvent.partnerCompanyId nullable + adding walk-in fields..."
psql -U vsys -d vsys_next -c "ALTER TABLE wash_events ALTER COLUMN partner_company_id DROP NOT NULL;" 2>/dev/null || true
psql -U vsys -d vsys_next -c "ALTER TABLE wash_events ADD COLUMN IF NOT EXISTS walk_in_invoice_requested BOOLEAN NOT NULL DEFAULT false;"
psql -U vsys -d vsys_next -c "ALTER TABLE wash_events ADD COLUMN IF NOT EXISTS walk_in_billing_name TEXT;"
psql -U vsys -d vsys_next -c "ALTER TABLE wash_events ADD COLUMN IF NOT EXISTS walk_in_billing_address TEXT;"
psql -U vsys -d vsys_next -c "ALTER TABLE wash_events ADD COLUMN IF NOT EXISTS walk_in_billing_city TEXT;"
psql -U vsys -d vsys_next -c "ALTER TABLE wash_events ADD COLUMN IF NOT EXISTS walk_in_billing_zip_code TEXT;"
psql -U vsys -d vsys_next -c "ALTER TABLE wash_events ADD COLUMN IF NOT EXISTS walk_in_billing_country TEXT;"
psql -U vsys -d vsys_next -c "ALTER TABLE wash_events ADD COLUMN IF NOT EXISTS walk_in_billing_tax_number TEXT;"
psql -U vsys -d vsys_next -c "ALTER TABLE wash_events ADD COLUMN IF NOT EXISTS walk_in_billing_email TEXT;"

# 2.5 Invoice.partnerCompanyId nullable + driver_id
echo "   2.5 Making Invoice.partnerCompanyId nullable + adding driver_id..."
psql -U vsys -d vsys_next -c "ALTER TABLE invoices ALTER COLUMN partner_company_id DROP NOT NULL;" 2>/dev/null || true
psql -U vsys -d vsys_next -c "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS driver_id TEXT;"
psql -U vsys -d vsys_next -c "CREATE INDEX IF NOT EXISTS invoices_driver_id_idx ON invoices(driver_id);"

# 2.6 Vehicle.partnerCompanyId nullable
echo "   2.6 Making Vehicle.partnerCompanyId nullable..."
psql -U vsys -d vsys_next -c "ALTER TABLE vehicles ALTER COLUMN partner_company_id DROP NOT NULL;" 2>/dev/null || true

# 2.7 DriverPartnerHistory.toCompanyId nullable
echo "   2.7 Making DriverPartnerHistory.toCompanyId nullable..."
psql -U vsys -d vsys_next -c "ALTER TABLE driver_partner_history ALTER COLUMN to_company_id DROP NOT NULL;" 2>/dev/null || true
psql -U vsys -d vsys_next -c "ALTER TABLE driver_partner_history DROP CONSTRAINT IF EXISTS driver_partner_history_to_company_id_fkey;"
psql -U vsys -d vsys_next -c "ALTER TABLE driver_partner_history ADD CONSTRAINT driver_partner_history_to_company_id_fkey FOREIGN KEY (to_company_id) REFERENCES partner_companies(id) ON DELETE SET NULL ON UPDATE CASCADE;" 2>/dev/null || true

echo "   Migration complete!"

# Generate Prisma client
echo ""
echo "3. Generating Prisma client..."
npx prisma generate

# Build backend
echo ""
echo "4. Building backend..."
npm run build

# Build frontend
echo ""
echo "5. Building frontend..."
cd pwa
npm run build
cd ..

# Restart services
echo ""
echo "6. Restarting services..."
pm2 restart vsys-next

echo ""
echo "=== Deploy Complete! ==="
echo "Check the application at https://app.vemiax.com"
echo ""
echo "New features:"
echo "  - Private customer registration (no partner company)"
echo "  - Location visibility settings (PUBLIC/NETWORK_ONLY/DEDICATED)"
echo "  - Walk-in customer invoice flow"
echo "  - Driver detach from partner functionality"
