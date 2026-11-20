-- =====================================================
-- MEDTRACK DATABASE
-- SCHEMA
--
-- Wird von PostgreSQL nur beim ERSTEN Start eines leeren
-- Volumes ausgeführt. Nach Änderungen neu aufsetzen mit:
--   docker compose down -v
--   docker compose up -d --build
-- =====================================================

-- Für Passwort-Hashing im seed.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =====================================================
-- BENUTZER
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,

    username VARCHAR(50) NOT NULL UNIQUE,

    password_hash VARCHAR(255) NOT NULL,

    role VARCHAR(50) NOT NULL DEFAULT 'User',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================================================
-- SENSOREN (fest montierte ESP32)
-- Position in Metern im Raum-Koordinatensystem
-- =====================================================

CREATE TABLE IF NOT EXISTS sensors (
    id VARCHAR(10) PRIMARY KEY,

    name VARCHAR(50) NOT NULL,

    x DOUBLE PRECISION NOT NULL,

    y DOUBLE PRECISION NOT NULL,

    ip VARCHAR(45),

    firmware VARCHAR(20),

    last_seen TIMESTAMPTZ
);


-- =====================================================
-- GERÄTE
-- =====================================================

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    type VARCHAR(100) NOT NULL,

    -- BLE-Name (z. B. 'MT-01') oder MAC-Adresse des Tags
    tag_id VARCHAR(50) UNIQUE,

    status VARCHAR(30) NOT NULL DEFAULT 'Verfügbar',

    borrowed_by INTEGER,

    borrowed_at TIMESTAMPTZ,

    -- zuletzt berechnete Position und Messwerte
    x DOUBLE PRECISION,

    y DOUBLE PRECISION,

    rssi_a DOUBLE PRECISION,

    rssi_b DOUBLE PRECISION,

    rssi_c DOUBLE PRECISION,

    distance_a DOUBLE PRECISION,

    distance_b DOUBLE PRECISION,

    distance_c DOUBLE PRECISION,

    last_seen TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_device_status
        CHECK (status IN ('Verfügbar', 'Ausgeliehen', 'Wartung')),

    CONSTRAINT fk_device_borrowed_by
        FOREIGN KEY (borrowed_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);


-- =====================================================
-- AKTUELLE MESSWERTE
-- je Gerät und Sensor genau eine Zeile, wird laufend überschrieben
-- =====================================================

CREATE TABLE IF NOT EXISTS tag_readings (
    device_id INTEGER NOT NULL,

    sensor_id VARCHAR(10) NOT NULL,

    rssi DOUBLE PRECISION NOT NULL,

    samples INTEGER NOT NULL DEFAULT 1,

    measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (device_id, sensor_id),

    CONSTRAINT fk_reading_device
        FOREIGN KEY (device_id)
        REFERENCES devices(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reading_sensor
        FOREIGN KEY (sensor_id)
        REFERENCES sensors(id)
        ON DELETE CASCADE
);


-- =====================================================
-- STANDORTVERLAUF (jede berechnete Position)
-- =====================================================

CREATE TABLE IF NOT EXISTS sensor_data (
    id SERIAL PRIMARY KEY,

    device_id INTEGER NOT NULL,

    rssi_a DOUBLE PRECISION,

    rssi_b DOUBLE PRECISION,

    rssi_c DOUBLE PRECISION,

    distance_a DOUBLE PRECISION,

    distance_b DOUBLE PRECISION,

    distance_c DOUBLE PRECISION,

    x DOUBLE PRECISION,

    y DOUBLE PRECISION,

    measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_sensor_device
        FOREIGN KEY (device_id)
        REFERENCES devices(id)
        ON DELETE CASCADE
);


-- =====================================================
-- GERÄTE-HISTORIE (Ausleihen, Rückgaben, ...)
-- =====================================================

CREATE TABLE IF NOT EXISTS device_history (
    id SERIAL PRIMARY KEY,

    device_id INTEGER NOT NULL,

    user_id INTEGER,

    action VARCHAR(50) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_history_device
        FOREIGN KEY (device_id)
        REFERENCES devices(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_history_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);


-- =====================================================
-- INDEXE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_devices_status
ON devices(status);

CREATE INDEX IF NOT EXISTS idx_history_device
ON device_history(device_id);

CREATE INDEX IF NOT EXISTS idx_history_created
ON device_history(created_at);

CREATE INDEX IF NOT EXISTS idx_sensor_data_device_time
ON sensor_data(device_id, measured_at);
