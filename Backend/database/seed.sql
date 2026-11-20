-- =====================================================
-- MedTrack Testdaten
-- =====================================================

-- Testbenutzer: admin / medtrack
-- (Hash wird von pgcrypto erzeugt, PHP password_verify() kann ihn prüfen)
INSERT INTO users
    (username, password_hash, role)
VALUES
    (
        'admin',
        crypt('medtrack', gen_salt('bf', 10)),
        'Administrator'
    )
ON CONFLICT (username) DO NOTHING;


-- Sensoren: A links unten, B rechts unten, C oben in der Mitte im 12 m × 11 m Raum
-- (x/y nach dem Aufstellen mit dem Maßband nachmessen und hier anpassen)
INSERT INTO sensors
    (id, name, x, y)
VALUES
    ('A', 'Sensor A', 0, 0),
    ('B', 'Sensor B', 12, 0),
    ('C', 'Sensor C', 6, 11)
ON CONFLICT (id) DO NOTHING;


-- Testgerät für den BLE-Beacon. tag_id = BLE-Name ('MT-01', z. B. ESP32-Test-Tag)
-- oder die MAC-Adresse des gekauften Beacons (siehe ESP32/README.md).
-- Weitere Demo-Geräte für den Simulator: demo_daten.sql
INSERT INTO devices
    (name, type, tag_id)
VALUES
    ('EKG #01', 'EKG-Gerät', 'MT-01')
ON CONFLICT (tag_id) DO NOTHING;
