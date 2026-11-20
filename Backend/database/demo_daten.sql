-- =====================================================
-- MedTrack Demo-Daten (archiviert)
--
-- Vier erfundene Geräte für Vorführungen mit dem Simulator
-- (Backend/tools/simulate_sensors.py sendet die Tags MT-01 bis MT-04).
-- Werden NICHT automatisch geladen. Bei Bedarf einspielen
-- (PowerShell, im Ordner Backend):
--   Get-Content database/demo_daten.sql | docker exec -i medtrack_db psql -U medtrack -d medtrack
--
-- Wieder entfernen:
--   docker exec medtrack_db psql -U medtrack -d medtrack -c "DELETE FROM devices WHERE tag_id IN ('MT-02', 'MT-03', 'MT-04');"
-- =====================================================

-- tag_id = BLE-Name, den der (simulierte) Tag aussendet
INSERT INTO devices
    (name, type, tag_id, x, y, last_seen)
VALUES
    ('EKG #01', 'EKG-Gerät', 'MT-01', 7.32, 5.28, now()),
    ('Pumpe #02', 'Infusionspumpe', 'MT-02', 9.36, 7.70, now()),
    ('Defi #03', 'Defibrillator', 'MT-03', 2.80, 8.60, now()),
    ('Beatmung #04', 'Beatmungsgerät', 'MT-04', 3.40, 3.10, now())
ON CONFLICT (tag_id) DO NOTHING;
