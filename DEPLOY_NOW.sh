#!/bin/bash
# Deploy script for VSys Next - Run this on the server

echo "=== VSys Next Deploy Script ==="
echo ""

# Navigate to project directory
cd /home/vsys/vsys-next

# Pull latest changes
echo "1. Pulling latest code..."
git pull origin master

# Run database migration
echo ""
echo "2. Running database migration..."
psql -U vsys -d vsys_next -c "ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS e_cegjegyzek_api_key TEXT;"
psql -U vsys -d vsys_next -c "ALTER TABLE network_settings ADD COLUMN IF NOT EXISTS e_cegjegyzek_api_key TEXT;"

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
