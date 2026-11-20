"""
MedTrack Sensor-Simulator

Schickt simulierte Messwerte an das Backend, als wären Sensor A, B und C
echte ESP32. Damit lässt sich die Weboberfläche ohne Hardware testen.
Es wird nur die Python-Standardbibliothek verwendet.

    py Backend/tools/simulate_sensors.py
    py Backend/tools/simulate_sensors.py --once
    py Backend/tools/simulate_sensors.py --url http://192.168.0.10:8080/api/sensors/report.php

Beenden mit Strg+C.
"""

import argparse
import json
import math
import os
import random
import statistics
import time
import urllib.error
import urllib.request

# Gleiche Werte wie in Backend/php/config.php
RSSI_AT_1M = -59.0
PATH_LOSS_EXPONENT = 2.5

# Gleiche Positionen wie in Backend/database/seed.sql
SENSORS = {"A": (0.0, 0.0), "B": (12.0, 0.0), "C": (6.0, 11.0)}

# Jeder Tag fährt eine Ellipse ab: Mittelpunkt, Halbachsen, Dauer einer Runde (s)
TAGS = {
    "MT-01": ((6.5, 5.5), (3.0, 2.2), 90),
    "MT-02": ((8.5, 7.5), (1.8, 1.4), 60),
    "MT-03": ((3.0, 8.2), (0.5, 0.4), 120),
    "MT-04": ((4.0, 3.6), (2.2, 1.6), 75),
}

SAMPLES_PER_REPORT = 9


def tag_position(tag, t):
    (cx, cy), (rx, ry), period = TAGS[tag]
    angle = 2 * math.pi * t / period
    return cx + rx * math.cos(angle), cy + ry * math.sin(angle)


def measured_rssi(sensor, position, noise):
    """Median mehrerer verrauschter Messungen – wie es der ESP32 macht."""
    sx, sy = SENSORS[sensor]
    distance = max(0.1, math.hypot(position[0] - sx, position[1] - sy))
    ideal = RSSI_AT_1M - 10 * PATH_LOSS_EXPONENT * math.log10(distance)
    samples = [ideal + random.gauss(0, noise) for _ in range(SAMPLES_PER_REPORT)]
    return round(statistics.median(samples))


def fake_mac(tag):
    number = int(tag.split("-")[-1])
    return f"a4:cf:12:00:00:{number:02x}"


def send(url, key, payload):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Api-Key": key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        body = error.read()
        try:
            return error.code, json.loads(body)
        except ValueError:
            return error.code, {"message": body.decode("utf-8", "replace")[:200]}


def main():
    parser = argparse.ArgumentParser(description="Simuliert die MedTrack ESP32-Sensoren.")
    parser.add_argument("--url", default="http://localhost:8080/api/sensors/report.php")
    parser.add_argument("--key", default=os.environ.get("MEDTRACK_API_KEY", "medtrack-sensor-key"))
    parser.add_argument("--interval", type=float, default=2.0, help="Sekunden zwischen zwei Meldungen")
    parser.add_argument("--noise", type=float, default=3.0, help="Rauschen der RSSI-Werte in dB")
    parser.add_argument("--once", action="store_true", help="nur eine Meldung je Sensor senden")
    args = parser.parse_args()

    print(f"Sende an {args.url} (Strg+C zum Beenden)")
    start = time.time()

    while True:
        t = time.time() - start
        positions = {tag: tag_position(tag, t) for tag in TAGS}
        line = [time.strftime("%H:%M:%S")]

        for sensor in SENSORS:
            readings = [
                {
                    "tag": tag,
                    "mac": fake_mac(tag),
                    "rssi": measured_rssi(sensor, position, args.noise),
                    "n": SAMPLES_PER_REPORT,
                }
                for tag, position in positions.items()
            ]
            payload = {"sensor": sensor, "fw": "simulator", "readings": readings}

            try:
                status, answer = send(args.url, args.key, payload)
            except urllib.error.URLError as error:
                print(f"Server nicht erreichbar ({error.reason}). Läuft 'docker compose up'?")
                return 1

            if status != 200:
                print(f"Sensor {sensor}: HTTP {status} – {answer.get('message', answer)}")
                return 1

            line.append(f"{sensor}: {answer.get('updated', 0)} Tags")

        line += [f"{tag} ({x:.1f}|{y:.1f})" for tag, (x, y) in positions.items()]
        print("  ".join(line))

        if args.once:
            return 0

        time.sleep(args.interval)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nBeendet.")
