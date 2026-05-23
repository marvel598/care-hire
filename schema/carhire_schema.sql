-- Car Hire Platform Schema
-- Core tables, indexes, and stored procedures for a 70/30 commission car hire platform.

-- 1. USERS (Owners & Renters combined)
CREATE TABLE IF NOT EXISTS users (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(50) NOT NULL,
    last_name       VARCHAR(50) NOT NULL,
    date_of_birth   DATE NOT NULL,
    drivers_license VARCHAR(50) UNIQUE,
    government_id   VARCHAR(50),
    user_type       VARCHAR(20) CHECK (user_type IN ('owner', 'renter', 'both')),
    kyc_status      VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'failed')),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. VEHICLES (Fleet management)
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID REFERENCES users(user_id) ON DELETE CASCADE,
    vin             VARCHAR(17) UNIQUE NOT NULL,
    license_plate   VARCHAR(20) UNIQUE NOT NULL,
    make            VARCHAR(30) NOT NULL,
    model           VARCHAR(30) NOT NULL,
    year            INT NOT NULL CHECK (year BETWEEN 1900 AND EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    color           VARCHAR(20),
    category        VARCHAR(30) CHECK (category IN ('economy', 'compact', 'luxury', 'suv', 'van', 'convertible')),
    daily_rate      DECIMAL(10,2) NOT NULL CHECK (daily_rate > 0),
    status          VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance', 'unavailable')),
    gps_device_id   VARCHAR(50),
    current_mileage INT DEFAULT 0,
    last_maintenance DATE,
    images          TEXT[],
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. LOCATIONS (Pickup/Dropoff points)
CREATE TABLE IF NOT EXISTS locations (
    location_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    address         TEXT NOT NULL,
    city            VARCHAR(50) NOT NULL,
    state           VARCHAR(50),
    country         VARCHAR(50) NOT NULL,
    postal_code     VARCHAR(20),
    phone           VARCHAR(20),
    latitude        DECIMAL(10,8),
    longitude       DECIMAL(11,8),
    is_active       BOOLEAN DEFAULT TRUE
);

-- 4. RENTALS (Hire Agreements)
CREATE TABLE IF NOT EXISTS rentals (
    rental_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_reference   VARCHAR(20) UNIQUE NOT NULL,
    vehicle_id          UUID REFERENCES vehicles(vehicle_id),
    renter_id           UUID REFERENCES users(user_id),
    pickup_location_id  UUID REFERENCES locations(location_id),
    dropoff_location_id UUID REFERENCES locations(location_id),
    start_date          TIMESTAMP NOT NULL,
    end_date            TIMESTAMP NOT NULL,
    actual_return_date  TIMESTAMP,
    start_mileage       INT,
    end_mileage         INT,
    total_amount        DECIMAL(10,2) NOT NULL,
    owner_earnings      DECIMAL(10,2) NOT NULL,
    platform_commission DECIMAL(10,2) NOT NULL,
    status              VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'overdue')),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    payment_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id           UUID REFERENCES rentals(rental_id),
    amount              DECIMAL(10,2) NOT NULL,
    payment_method      VARCHAR(30) CHECK (payment_method IN ('credit_card', 'debit_card', 'paypal', 'bank_transfer')),
    transaction_id      VARCHAR(100),
    payment_status      VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    owner_payout_status VARCHAR(20) DEFAULT 'pending' CHECK (owner_payout_status IN ('pending', 'processed', 'failed')),
    payment_date        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5a. REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token       TEXT PRIMARY KEY,
    user_id     UUID REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at  TIMESTAMP NOT NULL,
    revoked     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. GPS TRACKING (Location History)
CREATE TABLE IF NOT EXISTS tracking_history (
    tracking_id     BIGSERIAL PRIMARY KEY,
    vehicle_id      UUID REFERENCES vehicles(vehicle_id),
    rental_id       UUID REFERENCES rentals(rental_id),
    latitude        DECIMAL(10,8) NOT NULL,
    longitude       DECIMAL(11,8) NOT NULL,
    speed           DECIMAL(5,2),
    ignition_status BOOLEAN,
    recorded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
    review_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id       UUID REFERENCES rentals(rental_id),
    reviewer_id     UUID REFERENCES users(user_id),
    reviewee_id     UUID REFERENCES users(user_id),
    rating          INT CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. MAINTENANCE RECORDS
CREATE TABLE IF NOT EXISTS maintenance (
    maintenance_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id      UUID REFERENCES vehicles(vehicle_id),
    service_date    DATE NOT NULL,
    service_type    VARCHAR(50),
    odometer_reading INT,
    cost            DECIMAL(10,2),
    next_service_due DATE,
    notes           TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_rentals_renter ON rentals(renter_id);
CREATE INDEX IF NOT EXISTS idx_rentals_dates ON rentals(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rentals_vehicle ON rentals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_tracking_vehicle ON tracking_history(vehicle_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_drivers_license ON users(drivers_license);

-- Stored Procedures
CREATE OR REPLACE FUNCTION is_vehicle_available(
    p_vehicle_id UUID,
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM rentals
        WHERE vehicle_id = p_vehicle_id
        AND status IN ('pending', 'active')
        AND daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_commission(p_amount DECIMAL)
RETURNS TABLE(owner_share DECIMAL, platform_share DECIMAL) AS $$
BEGIN
    RETURN QUERY SELECT 
        p_amount * 0.70 AS owner_share,
        p_amount * 0.30 AS platform_share;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_vehicle_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' AND OLD.status = 'pending' THEN
        UPDATE vehicles SET status = 'rented' WHERE vehicle_id = NEW.vehicle_id;
    END IF;

    IF NEW.status = 'completed' AND OLD.status = 'active' THEN
        UPDATE vehicles SET status = 'available' WHERE vehicle_id = NEW.vehicle_id;
    END IF;

    IF NEW.end_date < CURRENT_TIMESTAMP AND NEW.status = 'active' THEN
        NEW.status := 'overdue';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_vehicle_status
AFTER UPDATE ON rentals
FOR EACH ROW
EXECUTE FUNCTION update_vehicle_status();
