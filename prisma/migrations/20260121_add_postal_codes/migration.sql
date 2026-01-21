-- Create PostalCode table for EU postal code database
-- Used for address autocomplete functionality

CREATE TABLE "postal_codes" (
    "id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postal_codes_pkey" PRIMARY KEY ("id")
);

-- Create indexes for efficient lookups
CREATE INDEX "postal_codes_country_code_idx" ON "postal_codes"("country_code");
CREATE INDEX "postal_codes_postal_code_idx" ON "postal_codes"("postal_code");
CREATE INDEX "postal_codes_city_idx" ON "postal_codes"("city");

-- Unique constraint: one entry per postal code per country
CREATE UNIQUE INDEX "postal_codes_country_code_postal_code_key" ON "postal_codes"("country_code", "postal_code");
