#!/bin/bash
# Seed Hungarian postal codes from GeoNames

cd /root/vsys-next

# Download Hungary postal codes
echo "Downloading Hungarian postal codes..."
curl -s -o /tmp/HU.zip https://download.geonames.org/export/zip/HU.zip
unzip -o -d /tmp /tmp/HU.zip

# Import into database
echo "Importing postal codes..."
docker exec -i vsys-postgres psql -U vsys vsys_next << 'EOSQL'
-- Create temp table for import
CREATE TEMP TABLE postal_import (
    country_code TEXT,
    postal_code TEXT,
    place_name TEXT,
    admin_name1 TEXT,
    admin_code1 TEXT,
    admin_name2 TEXT,
    admin_code2 TEXT,
    admin_name3 TEXT,
    admin_code3 TEXT,
    latitude TEXT,
    longitude TEXT,
    accuracy TEXT
);

-- Load data
\copy postal_import FROM '/tmp/HU.txt' WITH (FORMAT csv, DELIMITER E'\t', ENCODING 'UTF8');

-- Insert into postal_codes table
INSERT INTO postal_codes (id, country_code, postal_code, city, state, latitude, longitude, created_at)
SELECT
    gen_random_uuid()::text,
    country_code,
    postal_code,
    place_name,
    admin_name1,
    NULLIF(latitude, '')::float,
    NULLIF(longitude, '')::float,
    NOW()
FROM postal_import
ON CONFLICT (country_code, postal_code) DO UPDATE SET
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude;

SELECT COUNT(*) as imported_count FROM postal_codes WHERE country_code = 'HU';
EOSQL

# Cleanup
rm -f /tmp/HU.zip /tmp/HU.txt /tmp/readme.txt

echo "Done!"
