# MedTrack

**Find it. Track it. Use it.** – Ortung und Verwaltung mobiler medizinischer Geräte mit einem BLE-Beacon und drei ESP32-Empfängern.

HTL Krems · Projekt 26/27-AHBGM-MedTrack

## Aufbau

```
Backend/            PHP-API + PostgreSQL (Docker)
  php/              API-Endpunkte (unter /api erreichbar)
    auth/           login, logout, me
    devices/        get, borrow, return, history
    sensors/        get (Status), report (Empfang der ESP32-Messwerte)
    users/          get, create (nur Administrator)
    config.php      Raumgröße, Kalibrierung RSSI → Entfernung
    positioning.php Positionsberechnung (Trilateration mit A, B, C)
  database/         schema.sql + seed.sql (Admin, Sensoren A–C, Testgerät EKG #01)
                    update_3_sensoren.sql (ältere Datenbanken auf 3 Sensoren bringen)
                    demo_daten.sql (archivierte Demo-Geräte für den Simulator)
  tools/            simulate_sensors.py (Test ohne Hardware)
Frontend/           Weboberfläche (HTML, CSS, JavaScript)
ESP32/              Firmware für Empfänger und Test-Tag → siehe ESP32/README.md
```

## Starten (wenn alles eingerichtet ist)

1. **Handy-Hotspot** einschalten (iPhone: „Maximale Kompatibilität“ an) und die Hotspot-Seite offen lassen.
2. **Laptop mit dem Hotspot verbinden** – nicht mit HTL.EDU (Schul-WLAN geht mit den ESP32 nicht). Mit `ipconfig` prüfen, ob die IPv4-Adresse beim Adapter „WLAN“ dieselbe ist wie in der Server-URL der ESPs.
3. **Docker Desktop** starten, dann:
   ```powershell
   cd Backend
   docker compose up -d
   ```
4. **ESPs mit Strom versorgen** (Powerbank, USB-Netzteil oder Laptop). Sie verbinden sich selbst mit dem Hotspot – kein Flashen nötig.
5. **Beacon**: Batterie drin (Plus-Seite zum Metallbügel) – er sendet von selbst.
6. Im Browser <http://localhost:8080> öffnen – Testzugang **admin / medtrack**. Oben rechts steht „x/3 Sensoren online“, das Testgerät EKG #01 zeigt „LIVE“.

| Problem | Ursache |
|---|---|
| „Sensoren offline“ | Laptop nicht im Hotspot (Windows wechselt gern automatisch ins Schul-WLAN), Hotspot aus oder Laptop-IP geändert |
| „Server nicht erreichbar“ | Docker läuft nicht → Docker Desktop starten, `docker compose up -d` |
| Sensoren online, Gerät „Kein Signal“ | Beacon sendet nicht (Batterie falsch herum/leer) oder ist zu weit weg |

Erstes Einrichten der ESP32 (Flashen, MAC des Beacons, Positionen, Kalibrierung): siehe [ESP32/README.md](ESP32/README.md).

> **Wichtig nach Änderungen am Datenbankschema:** PostgreSQL führt `schema.sql` und `seed.sql` nur beim ersten Start mit leerem Volume aus. Bestehende Datenbanken ohne Datenverlust aktualisieren:
>
> ```powershell
> Get-Content database/update_3_sensoren.sql | docker exec -i medtrack_db psql -U medtrack -d medtrack
> ```
>
> Oder komplett neu aufsetzen (löscht alle Daten!):
>
> ```powershell
> docker compose down -v
> docker compose up -d --build
> ```

## Ohne Hardware testen

Der Simulator schickt dieselben Daten wie die echten ESP32-Sensoren A, B und C. Er braucht die Demo-Geräte, die zuerst geladen werden:

```powershell
cd Backend
Get-Content database/demo_daten.sql | docker exec -i medtrack_db psql -U medtrack -d medtrack
cd ..
py Backend/tools/simulate_sensors.py
```

Die Geräte bewegen sich dann auf dem Lageplan. Entfernen der Demo-Geräte: siehe Kommentar in `Backend/database/demo_daten.sql`.

## Wie die Ortung funktioniert

1. Der BLE-Beacon am Gerät sendet laufend ein kurzes Funksignal mit seiner Kennung (MAC-Adresse).
2. Jeder Empfänger (ESP32 A, B, C) misst die Signalstärke (RSSI) und schickt alle 2 s den Median an `api/sensors/report.php`.
3. Das Backend rechnet RSSI in eine Entfernung um: `d = 10 ^ ((RSSI_1m − RSSI) / (10 · n))`.
4. Um jeden Empfänger entsteht ein Kreis mit dieser Entfernung. Aus den drei Kreisen wird die Position berechnet (Trilateration). Sehen nur zwei Empfänger das Gerät, wird der passende Schnittpunkt der zwei Kreise verwendet.
5. Die Weboberfläche fragt alle 3 s die Geräte ab und zeigt Position, Messkreise und Signalwerte an.

Ein Gerät gilt als **„Kein Signal“**, wenn es länger als 30 s von keinem Sensor gehört wurde.
