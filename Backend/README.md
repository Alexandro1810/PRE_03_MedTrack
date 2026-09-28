# MedTrack – vollständige Demo

## Start

1. Docker Desktop starten.
2. In VS Code ein Terminal im Ordner `Backend` öffnen.
3. Ausführen:

```bash
docker compose up -d --build
```

4. Browser öffnen: http://localhost:9999
5. Einmal `http://localhost:9999/api/auth/setup.php` öffnen, damit die vier Testbenutzer angelegt werden.
6. Danach MedTrack neu laden.

## Testbenutzer

- admin / medtrack — Administrator
- Alex / Wöhrer — Benutzer
- Julian / Tschiltsch — Benutzer
- Leon / Parzer — Benutzer

## Datenbank

MySQL läuft als Docker-Container. Die Tabellen werden beim ersten Start über `database/init.sql` angelegt.

Wenn die Datenbank komplett neu initialisiert werden soll:

```bash
docker compose down -v
docker compose up -d --build
```

Achtung: `down -v` löscht die gespeicherten Daten.

## Funktionen

- echter PHP-Session-Login
- Passwort-Hashing
- Benutzerverwaltung nur für Administratoren
- eigene Passworteinstellungen
- Geräteübersicht
- Ausleihen / Zurückgeben
- Gerätehistorie
- Kalender mit Datenbank
- Gerätebezug bei Kalendereinträgen
- Position/RSSI API für ESP32
