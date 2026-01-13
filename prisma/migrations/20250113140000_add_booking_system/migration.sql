-- =============================================================================
-- BOOKING SYSTEM MIGRATION
-- Időpontfoglalás modul adatbázis bővítések
-- NOTE: Uses TEXT for foreign keys to match existing table schema
-- =============================================================================

-- 1. Új enum típusok
-- =============================================================================

-- Foglalás státuszok
CREATE TYPE "BookingStatus" AS ENUM (
  'PENDING',        -- Foglalás létrejött, várakozik
  'CONFIRMED',      -- Megerősítve
  'IN_PROGRESS',    -- Mosás folyamatban
  'COMPLETED',      -- Befejezve
  'CANCELLED',      -- Lemondva (ügyfél által)
  'NO_SHOW',        -- Nem jelent meg
  'REFUNDED'        -- Visszatérítve
);

-- Fizetési státuszok
CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',        -- Fizetésre vár
  'PAID',           -- Kifizetve
  'PARTIALLY_PAID', -- Részben fizetve (előleg)
  'REFUNDED',       -- Visszatérítve
  'FAILED'          -- Sikertelen
);

-- Online fizetési szolgáltatók
CREATE TYPE "PaymentProvider" AS ENUM (
  'STRIPE',
  'SIMPLEPAY',
  'BARION',
  'CASH',
  'CARD_ON_SITE'
);

-- Nap típusok nyitvatartáshoz
CREATE TYPE "DayOfWeek" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
);

-- 2. ServicePrice bővítése időtartammal
-- =============================================================================

ALTER TABLE "service_prices" ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER DEFAULT 30;

-- 3. Location bővítése időpontfoglalási mezőkkel
-- =============================================================================

ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "booking_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "parallel_slots" INTEGER DEFAULT 1;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "slot_interval_minutes" INTEGER DEFAULT 30;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "min_booking_notice_hours" INTEGER DEFAULT 1;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "max_booking_advance_days" INTEGER DEFAULT 30;

-- 4. Driver bővítése magánszemély adatokkal
-- =============================================================================

ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "is_private_customer" BOOLEAN DEFAULT false;
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "billing_name" VARCHAR(255);
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "billing_address" VARCHAR(500);
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "billing_city" VARCHAR(100);
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "billing_zip_code" VARCHAR(20);
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "billing_country" VARCHAR(2) DEFAULT 'HU';
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "billing_tax_number" VARCHAR(50);

-- 5. Strukturált nyitvatartás tábla
-- =============================================================================

CREATE TABLE IF NOT EXISTS "location_opening_hours" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "location_id" TEXT NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  "day_of_week" "DayOfWeek" NOT NULL,
  "open_time" TEXT NOT NULL,
  "close_time" TEXT NOT NULL,
  "is_closed" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("location_id", "day_of_week")
);

CREATE INDEX "location_opening_hours_location_id_idx" ON "location_opening_hours"("location_id");

-- 6. Letiltott időpontok tábla (walk-in ügyfeleknek fenntartott időszakok)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "blocked_time_slots" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "network_id" TEXT NOT NULL REFERENCES "networks"("id") ON DELETE CASCADE,
  "location_id" TEXT NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  "start_time" TIMESTAMP(3) NOT NULL,
  "end_time" TIMESTAMP(3) NOT NULL,
  "reason" VARCHAR(500),
  "is_recurring" BOOLEAN DEFAULT false,
  "recurring_day_of_week" "DayOfWeek",
  "recurring_start_time" TIME,
  "recurring_end_time" TIME,
  "created_by" VARCHAR(100),
  "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "blocked_time_slots_network_id_idx" ON "blocked_time_slots"("network_id");
CREATE INDEX "blocked_time_slots_location_id_idx" ON "blocked_time_slots"("location_id");
CREATE INDEX "blocked_time_slots_start_time_idx" ON "blocked_time_slots"("start_time");

-- 7. Foglalási beállítások (Network szintű)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "booking_settings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "network_id" TEXT NOT NULL UNIQUE REFERENCES "networks"("id") ON DELETE CASCADE,

  -- Lemondási szabályzat
  "cancellation_deadline_hours" INTEGER DEFAULT 24,
  "cancellation_fee_percent" DECIMAL(5, 2) DEFAULT 50.00,
  "no_show_fee_percent" DECIMAL(5, 2) DEFAULT 100.00,

  -- Email emlékeztetők
  "reminder_enabled" BOOLEAN DEFAULT true,
  "reminder_hours_before" INTEGER[] DEFAULT '{24, 2}',

  -- Fizetési beállítások
  "require_prepayment_online" BOOLEAN DEFAULT false,
  "allow_pay_on_site_cash" BOOLEAN DEFAULT true,
  "allow_pay_on_site_card" BOOLEAN DEFAULT true,
  "allow_online_card" BOOLEAN DEFAULT true,
  "allow_apple_pay" BOOLEAN DEFAULT false,
  "allow_google_pay" BOOLEAN DEFAULT false,

  -- Fizetési szolgáltatók kulcsai (opcionális - lehet platform szintű is)
  "stripe_account_id" VARCHAR(255),
  "simplepay_merchant_id" VARCHAR(255),
  "simplepay_secret_key" VARCHAR(500),
  "barion_pos_key" VARCHAR(255),
  "barion_pixel_id" VARCHAR(100),

  -- Üzenetszövegek
  "cancellation_policy_text" TEXT,
  "confirmation_message" TEXT,

  "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- 8. Foglalás tábla
-- =============================================================================

CREATE TABLE IF NOT EXISTS "bookings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "network_id" TEXT NOT NULL REFERENCES "networks"("id") ON DELETE CASCADE,
  "location_id" TEXT NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  "driver_id" TEXT REFERENCES "drivers"("id") ON DELETE SET NULL,

  -- Foglalás azonosító (egyedi, olvasható)
  "booking_code" VARCHAR(20) NOT NULL UNIQUE,

  -- Időpont
  "scheduled_start" TIMESTAMP(3) NOT NULL,
  "scheduled_end" TIMESTAMP(3) NOT NULL,

  -- Jármű info
  "vehicle_type" "VehicleType" NOT NULL,
  "plate_number" VARCHAR(20),

  -- Szolgáltatás
  "service_package_id" TEXT NOT NULL REFERENCES "service_packages"("id"),
  "service_duration_minutes" INTEGER NOT NULL,
  "service_price" DECIMAL(10, 2) NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'HUF',

  -- Ügyfél adatok (ha nem Driver, vagy Driver de magánszemély)
  "customer_name" VARCHAR(255),
  "customer_phone" VARCHAR(50),
  "customer_email" VARCHAR(255),

  -- Státusz
  "status" "BookingStatus" DEFAULT 'PENDING',

  -- Fizetés
  "payment_status" "PaymentStatus" DEFAULT 'PENDING',
  "payment_provider" "PaymentProvider",
  "payment_method_selected" VARCHAR(50),
  "prepaid_amount" DECIMAL(10, 2) DEFAULT 0,
  "paid_on_site_amount" DECIMAL(10, 2) DEFAULT 0,
  "total_paid" DECIMAL(10, 2) DEFAULT 0,
  "refunded_amount" DECIMAL(10, 2) DEFAULT 0,

  -- Fizetési tranzakció referenciák
  "stripe_payment_intent_id" VARCHAR(255),
  "simplepay_transaction_id" VARCHAR(255),
  "barion_payment_id" VARCHAR(255),

  -- Lemondás
  "cancelled_at" TIMESTAMP(3),
  "cancelled_by" VARCHAR(100),
  "cancellation_reason" VARCHAR(500),
  "cancellation_fee_applied" DECIMAL(10, 2),

  -- Mosáshoz kapcsolás
  "wash_event_id" TEXT REFERENCES "wash_events"("id") ON DELETE SET NULL,

  -- Emlékeztetők
  "reminder_sent_at" TIMESTAMP(3)[],

  -- Ki hozta létre
  "created_by_type" VARCHAR(50),
  "created_by_id" VARCHAR(100),

  -- Audit
  "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT
);

CREATE INDEX "bookings_network_id_idx" ON "bookings"("network_id");
CREATE INDEX "bookings_location_id_idx" ON "bookings"("location_id");
CREATE INDEX "bookings_driver_id_idx" ON "bookings"("driver_id");
CREATE INDEX "bookings_scheduled_start_idx" ON "bookings"("scheduled_start");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
CREATE INDEX "bookings_booking_code_idx" ON "bookings"("booking_code");
CREATE INDEX "bookings_customer_email_idx" ON "bookings"("customer_email");

-- 9. Fizetési tranzakciók tábla
-- =============================================================================

CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "network_id" TEXT NOT NULL REFERENCES "networks"("id") ON DELETE CASCADE,
  "booking_id" TEXT REFERENCES "bookings"("id") ON DELETE SET NULL,
  "wash_event_id" TEXT REFERENCES "wash_events"("id") ON DELETE SET NULL,

  -- Tranzakció típus
  "type" VARCHAR(50) NOT NULL,
  "provider" "PaymentProvider" NOT NULL,

  -- Összegek
  "amount" DECIMAL(10, 2) NOT NULL,
  "currency" VARCHAR(3) DEFAULT 'HUF',
  "fee_amount" DECIMAL(10, 2) DEFAULT 0,

  -- Státusz
  "status" "PaymentStatus" NOT NULL,

  -- Provider specifikus adatok
  "provider_transaction_id" VARCHAR(255),
  "provider_response" JSONB,

  -- Visszatérítés
  "refund_of_transaction_id" TEXT REFERENCES "payment_transactions"("id"),
  "refund_reason" VARCHAR(500),

  -- Audit
  "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3)
);

CREATE INDEX "payment_transactions_network_id_idx" ON "payment_transactions"("network_id");
CREATE INDEX "payment_transactions_booking_id_idx" ON "payment_transactions"("booking_id");
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");
CREATE INDEX "payment_transactions_provider_transaction_id_idx" ON "payment_transactions"("provider_transaction_id");

-- 10. WashEvent bővítése booking referenciával
-- =============================================================================

ALTER TABLE "wash_events" ADD COLUMN IF NOT EXISTS "booking_id" TEXT REFERENCES "bookings"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "wash_events_booking_id_idx" ON "wash_events"("booking_id");

-- 11. Network relations frissítése
-- =============================================================================

-- Komment hozzáadása dokumentációként
COMMENT ON TABLE "bookings" IS 'Időpontfoglalások táblája - mosó helyszínekre előre foglalt időpontok';
COMMENT ON TABLE "booking_settings" IS 'Hálózat szintű foglalási beállítások - lemondási szabályzat, fizetési módok';
COMMENT ON TABLE "blocked_time_slots" IS 'Letiltott időszakok - walk-in ügyfeleknek fenntartott időpontok';
COMMENT ON TABLE "location_opening_hours" IS 'Strukturált nyitvatartási idők naponként';
COMMENT ON TABLE "payment_transactions" IS 'Online fizetési tranzakciók nyilvántartása';
