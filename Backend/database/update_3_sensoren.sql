-- =====================================================
-- MEDTRACK DATABASE
-- UPDATE: Sensor C (drei Empfänger statt zwei)
--
-- Nur für Datenbanken, die vor dem 16.11.2026 angelegt wurden.
-- Fügt die neuen Spalten und Sensor C hinzu, ohne Daten zu löschen.
-- Kann gefahrlos mehrfach ausgeführt werden.
--
-- Ausführen (PowerShell, im Ordner Backend):
--   Get-Content database/update_3_sensoren.sql | docker exec -i medtrack_db psql -U medtrack -d medtrack
-- =====================================================

ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS rssi_c DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS distance_c DOUBLE PRECISION;

ALTER TABLE sensor_data
    ADD COLUMN IF NOT EXISTS rssi_c DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS distance_c DOUBLE PRECISION;

INSERT INTO sensors
    (id, name, x, y)
VALUES
    ('C', 'Sensor C', 6, 11)
ON CONFLICT (id) DO NOTHING;
