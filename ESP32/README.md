# MedTrack – ESP32-Firmware

| Projekt | Zweck |
|---|---|
| `MedTrack_Sensor/` | Firmware für die **fest montierten Empfänger A, B und C**. Scannt dauerhaft nach BLE-Tags, bildet pro Tag den RSSI-Median und schickt ihn alle 2 s per WLAN an das Backend. |
| `MedTrack_Tag/` | Optional: macht einen weiteren ESP32 zu einem **Test-Tag** (Beacon „MT-01“), solange noch kein gekaufter Beacon da ist. |

Alle drei Empfänger bekommen **dieselbe Firmware** – nur die Sensor-ID (A, B oder C) wird in `menuconfig` umgestellt.

Aufbau im Raum: siehe [MedTrack_Hardware-Aufbau.png](MedTrack_Hardware-Aufbau.png) (Quelldatei `MedTrack_Hardware-Aufbau.drawio`).

## Hardware

| Teil | Anzahl | Hinweis |
|---|---|---|
| ESP32-DevKit (ESP32-WROOM-32, 38 Pins) | 3 | Empfänger A, B, C |
| **Micro-USB**-Kabel **mit Datenleitung** | 1–3 | Das Board hat Micro-USB, nicht USB-C. Reine Ladekabel funktionieren zum Flashen nicht. |
| USB-Netzteil 5 V oder Powerbank | 3 | Stromversorgung im Betrieb |
| BLE-Beacon nRF52810 + Knopfzelle CR2032 | 1 | wird am Testgerät befestigt |
| WLAN-Router oder Handy-Hotspot (2,4 GHz) | 1 | ESP32 und Laptop müssen im selben WLAN sein |

**Verkabelung:** An den Pins wird nichts angeschlossen. Die Antenne für Bluetooth und WLAN ist im ESP32-Modul eingebaut, jeder ESP32 braucht nur Strom über Micro-USB.

Erscheint beim Anstecken kein COM-Port im Geräte-Manager, fehlt der Treiber für den USB-Chip (CP210x von Silicon Labs) oder das Kabel ist ein reines Ladekabel.

## Täglicher Start (wenn alles eingerichtet ist)

1. **Handy-Hotspot** einschalten (iPhone: „Maximale Kompatibilität“ an) und die Hotspot-Seite offen lassen.
2. **Laptop mit dem Hotspot verbinden** – nicht mit HTL.EDU. Mit `ipconfig` prüfen, ob die IPv4-Adresse beim Adapter „WLAN“ dieselbe ist wie in der Server-URL der ESPs. Wenn nicht: Server-URL in `menuconfig` anpassen und alle ESPs neu flashen.
3. **Docker Desktop** starten, dann im Ordner `Backend`: `docker compose up -d`
4. **ESPs mit Strom versorgen** (Powerbank, USB-Netzteil oder Laptop). Sie verbinden sich selbst mit dem Hotspot – kein Flashen nötig.
5. **Beacon**: Batterie drin (Plus-Seite zum Metallbügel) – er sendet von selbst.
6. **Browser**: http://localhost:8080 öffnen und anmelden. Oben rechts muss „x/3 Sensoren online“ stehen, das Testgerät zeigt „LIVE“.

Optional die Meldungen eines ESP ansehen (ohne neu zu flashen): in der IDF-PowerShell im Ordner `MedTrack_Sensor` `idf.py -p COM3 monitor`.

| Problem | Ursache |
|---|---|
| „Sensoren offline“ | Laptop nicht im Hotspot (Windows wechselt gern automatisch ins Schul-WLAN), Hotspot aus oder Laptop-IP geändert |
| „Server nicht erreichbar“ | Docker läuft nicht → Docker Desktop starten, `docker compose up -d` |
| Sensoren online, Gerät „Kein Signal“ | Beacon sendet nicht (Batterie falsch herum/leer) oder ist zu weit weg |

## Build-Ordner (wichtig bei OneDrive)

ESP-IDF 6.1 kann nicht in einem Ordner bauen, dessen Pfad mehrmals ` - ` enthält – wie `OneDrive - HTL Krems\Klassen - Schule\…`. Der Compiler bricht dann mit `linker input file not found` und einem verstümmelten Pfad (`Klassen Schule`) ab.

Deshalb liegt in `MedTrack_Sensor/` und `MedTrack_Tag/` je eine `CMakePresets.json`: Damit baut `idf.py` automatisch nach **`C:\esp\build\MedTrack_Sensor`** bzw. **`C:\esp\build\MedTrack_Tag`**. Die Befehle bleiben gleich (`idf.py build`, `idf.py -p COM5 flash monitor`), es erscheint nur der gelbe Hinweis `using 'default' preset`. Die Einstellungen (`sdkconfig`) bleiben im Projektordner.

## Warum ESP-IDF und nicht Arduino?

- ESP-IDF 6.1 ist bereits installiert, Arduino bräuchte eine zweite Toolchain.
- WLAN und Bluetooth teilen sich beim ESP32 eine Antenne. Mit NimBLE lässt sich das Scan-Fenster genau einstellen (50 ms scannen / 50 ms Pause), damit das WLAN genug Zeit zum Senden hat. Die Arduino-BLE-Bibliothek ist dafür deutlich schwerer zu steuern und braucht mehr Speicher.
- Das Projekt braucht keine externen Bibliotheken – alles ist in ESP-IDF enthalten.

## Datenfluss

```
                ──Advertising──▶ ESP32 Sensor A ─┐
BLE-Beacon      ──Advertising──▶ ESP32 Sensor B ─┤  HTTP POST alle 2 s
am Gerät        ──Advertising──▶ ESP32 Sensor C ─┤
                                                 ▼
                       Backend/php/sensors/report.php
                         RSSI → Entfernung → Trilateration (positioning.php)
                                                 ▼
                       PostgreSQL ──▶ Weboberfläche (Raumkarte)
```

Gesendet wird z. B.:

```json
{"sensor":"A","fw":"1.0.0","uptime":120,
 "readings":[{"tag":"","mac":"ac:23:3f:12:34:56","rssi":-63,"n":12}]}
```

Sehen alle drei Sensoren den Beacon, berechnet das Backend die Position per **Trilateration**. Sehen ihn gerade nur zwei, wird der passende Schnittpunkt der zwei Kreise verwendet.

## Schon jetzt vorbereiten (ohne Kabel und Beacon)

### 1. Backend neu aufsetzen

Die Datenbank hat jetzt Spalten für Sensor C. PostgreSQL legt die Tabellen aber nur bei einer **leeren** Datenbank an, deshalb einmal neu aufsetzen:

```powershell
cd "...\PRE_03_MedTrack\Backend"
docker compose down -v
docker compose up -d --build
```

> `down -v` löscht die Datenbank. Danach sind wieder nur die Testdaten aus `seed.sql` da (Login `admin` / `medtrack`).

**Ohne Datenverlust** geht es mit dem Update-Skript – es fügt nur die neuen Spalten und Sensor C hinzu (Backend muss laufen):

```powershell
cd "...\PRE_03_MedTrack\Backend"
Get-Content database/update_3_sensoren.sql | docker exec -i medtrack_db psql -U medtrack -d medtrack
```

Ohne eines der beiden meldet die Weboberfläche nach dem Anmelden „Server nicht erreichbar“ (im Log: `column d.rssi_c does not exist`).

### 2. Mit dem Simulator testen

Der Simulator tut so, als wären A, B und C echte ESP32. Er braucht die vier Demo-Geräte (Tags `MT-01` … `MT-04`). Die sind archiviert und werden bei Bedarf geladen:

```powershell
cd "...\PRE_03_MedTrack\Backend"
Get-Content database/demo_daten.sql | docker exec -i medtrack_db psql -U medtrack -d medtrack
cd ..
py Backend/tools/simulate_sensors.py
```

Entfernen der Demo-Geräte: siehe Kommentar in `Backend/database/demo_daten.sql`. Standardmäßig gibt es nur das Testgerät **EKG #01** für den echten Beacon.

Auf http://localhost:8080 bewegen sich dann die Testgeräte über die Raumkarte. Bei einem ausgewählten Gerät sieht man die drei Messkreise und im Signalmonitor RSSI und Distanz zu A, B und C.

### 3. Firmware einstellen und bauen

In der **ESP-IDF 6.1 PowerShell**:

```powershell
cd "...\PRE_03_MedTrack\ESP32\MedTrack_Sensor"
idf.py set-target esp32
idf.py menuconfig
```

Unter **MedTrack Sensor** eintragen:

| Einstellung | Beispiel |
|---|---|
| Sensor-ID | `A` |
| WLAN-Name / Passwort | euer Hotspot (2,4 GHz) |
| Server-URL | `http://192.168.0.42:8080/api/sensors/report.php` (IP des Laptops: `ipconfig` → „IPv4-Adresse“) |
| API-Key | wie `MEDTRACK_API_KEY` in `Backend/.env` |
| Beacon-Suche | **an** lassen (ist Standard) |

Mit `S` speichern, mit `Q` beenden. Dann einmal bauen – dafür braucht man noch kein Board:

```powershell
idf.py build
```

Die Einstellungen bleiben in der Datei `sdkconfig` gespeichert. Sobald das Kabel da ist, muss man nur noch flashen.

> WLAN: Der ESP32 kann **nur 2,4 GHz** und **kein WPA2-Enterprise** (Benutzername + Passwort wie im Schul-WLAN). Am einfachsten einen Handy-Hotspot verwenden, mit dem auch der Laptop verbunden ist. Die Laptop-IP ändert sich je nach WLAN – dann die Server-URL anpassen.

## Wenn das Kabel da ist: Sensor A flashen

Board anstecken, COM-Port im Geräte-Manager nachsehen und:

```powershell
idf.py -p COM5 flash monitor
```

Den Monitor beendet man mit `Strg + ]`. Im Monitor sollte nach ein paar Sekunden `Gesendet (HTTP 200)` erscheinen – dann ist Sensor A in der Weboberfläche online.

## Wenn der Beacon da ist

### 1. Beacon einstellen

- Knopfzelle CR2032 einlegen (ist nicht dabei).
- In der App des Beacons das **Sendeintervall auf ca. 200 ms** stellen (ab Werk 500 ms). Die Sendeleistung auf dem Standardwert lassen und danach nicht mehr ändern, sonst stimmt die Kalibrierung nicht mehr.

### 2. MAC-Adresse herausfinden

Den Beacon direkt neben **Sensor A** legen. Die Beacon-Suche gibt im Monitor alle 5 s die Geräte in der Nähe aus:

```
Beacon-Suche: 2 Geraet(e) in der Naehe (staerkstes Signal = naechstes Geraet):
  AC:23:3F:12:34:56  RSSI  -38 dBm  iBeacon
  5D:11:9A:0C:44:21  RSSI  -57 dBm  BLE
```

Der Eintrag mit dem **stärksten Signal** (Zahl am nächsten bei 0) ist der Beacon – meist mit `iBeacon` oder `Eddystone` markiert. Zur Kontrolle den Beacon wegnehmen: Dann muss der Eintrag verschwinden. Alternativ zeigt auch die Handy-App **nRF Connect** die MAC-Adresse an.

### 3. MAC eintragen und alle drei Sensoren flashen

```powershell
idf.py menuconfig
```

- **Zusätzliche Tag-MAC-Adressen**: die MAC des Beacons, z. B. `AC:23:3F:12:34:56`
- **Beacon-Suche**: ausschalten

Dann nacheinander alle drei Boards flashen. Zwischendurch in `menuconfig` **nur die Sensor-ID** ändern:

| Board | Sensor-ID | Befehl (COM-Port anpassen) |
|---|---|---|
| 1 | `A` | `idf.py -p COM5 flash monitor` |
| 2 | `B` | `idf.py -p COM6 flash monitor` |
| 3 | `C` | `idf.py -p COM7 flash monitor` |

Die Boards am besten beschriften (A, B, C).

### 4. Beacon einem Gerät zuordnen

In der Datenbank beim Testgerät die MAC-Adresse als `tag_id` eintragen:

```powershell
docker exec -it medtrack_db psql -U medtrack -d medtrack -c "UPDATE devices SET tag_id = 'ac:23:3f:12:34:56' WHERE name = 'EKG #01';"
```

Solange das fehlt, meldet der Monitor `Unbekannte Tags …`.

### 5. Positionen der Empfänger eintragen

A, B und C möglichst weit auseinander aufstellen (z. B. drei Raumecken), ca. 1–2 m hoch und nicht direkt hinter Metall. Dann mit dem Maßband die Positionen in Metern messen – Ursprung (0 | 0) ist die linke untere Ecke des Raums – und eintragen:

```powershell
docker exec -it medtrack_db psql -U medtrack -d medtrack -c "UPDATE sensors SET x = 0, y = 0 WHERE id = 'A'; UPDATE sensors SET x = 8, y = 0 WHERE id = 'B'; UPDATE sensors SET x = 4, y = 6 WHERE id = 'C';"
```

Die Raumgröße steht in `Backend/php/config.php` (`ROOM_WIDTH`, `ROOM_HEIGHT`).

## Test-Tag ohne gekauften Beacon (optional)

Bis der Beacon da ist, geht auch ein Handy: In der App **nRF Connect** einen Advertiser mit dem Namen `MT-01` anlegen. Oder ein weiteres ESP32-Board als Test-Tag flashen:

```powershell
cd "...\PRE_03_MedTrack\ESP32\MedTrack_Tag"
idf.py set-target esp32
idf.py menuconfig          # MedTrack Tag -> Name z. B. MT-01
idf.py -p COM8 flash monitor
```

Tags mit Namen `MT-…` werden automatisch erkannt, dafür braucht man keine MAC-Adresse einzutragen.

## Kalibrieren

Die Umrechnung RSSI → Entfernung passiert im Backend in `Backend/php/config.php`:

- `RSSI_AT_1M`: Beacon in genau **1 m** Abstand vor einen Sensor legen, ca. 30 s warten, den im Monitor angezeigten RSSI-Wert eintragen.
- `PATH_LOSS_EXPONENT`: Beacon in z. B. 5 m Abstand legen und den Wert so anpassen, dass die Weboberfläche ca. 5 m anzeigt (typisch 2,0–3,0).

Danach ist kein neues Flashen nötig.

> Realistisch erreicht RSSI-Ortung mit drei Sensoren eine Genauigkeit von etwa **1–2 m**. Je weiter A, B und C auseinander stehen, desto besser.

## Fehlersuche (Meldungen im Monitor)

| Meldung | Ursache / Lösung |
|---|---|
| `Keine Verbindung zu "…" (Grund 201)` | WLAN nicht gefunden – 2,4 GHz? Name richtig geschrieben? |
| `Keine Verbindung … (Grund 15)` oder `(Grund 204)` | falsches WLAN-Passwort |
| `Server nicht erreichbar` | falsche IP in der Server-URL, Docker läuft nicht, oder die Windows-Firewall blockiert Port 8080 |
| `API-Key abgelehnt (401)` | API-Key in `menuconfig` und `Backend/.env` stimmen nicht überein |
| `Server antwortet mit HTTP 404 … Unbekannter Sensor` | Sensor-ID nicht in der Tabelle `sensors` (bei C: Backend neu aufsetzen, siehe oben) |
| `Unbekannte Tags …` | Tag wird empfangen, ist aber keinem Gerät zugeordnet → `tag_id` in `devices` eintragen |
| `Beacon-Suche: kein BLE-Geraet …` | Beacon sendet nicht (Batterie?) oder liegt zu weit weg – direkt neben den ESP32 legen |
| keine Zeilen mit `RSSI` | Tag sendet nicht, MAC falsch eingetragen, Name passt nicht zum Prefix oder zu wenige Messwerte im Zeitfenster (Sendeintervall auf ca. 200 ms stellen) |
| kein COM-Port | Ladekabel ohne Datenleitung oder CP210x-Treiber fehlt |
