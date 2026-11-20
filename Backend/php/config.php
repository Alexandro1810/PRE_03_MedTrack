<?php

/* =====================================================
   MEDTRACK KONFIGURATION
===================================================== */

// Raum / Koordinatensystem in Metern.
// Ursprung (0 | 0) = linke untere Ecke des Raums.
const STATION_NAME = "Station 2";
const ROOM_NAME = "Raum 01";
const ROOM_WIDTH = 12.0;
const ROOM_HEIGHT = 11.0;


// Umrechnung RSSI -> Entfernung (Log-Distance-Pfadverlustmodell):
//
//   d = 10 ^ ((RSSI_AT_1M - RSSI) / (10 * PATH_LOSS_EXPONENT))
//
// RSSI_AT_1M unbedingt kalibrieren: Tag in genau 1 m Abstand
// vor einen Sensor legen und den gemeldeten RSSI-Median eintragen.
const RSSI_AT_1M = -59.0;

// 2.0 = freie Sicht, 2.5–3.5 = Innenraum mit Möbeln und Personen
const PATH_LOSS_EXPONENT = 2.5;


// Zeitgrenzen in Sekunden
const READING_MAX_AGE = 10;   // so alt dürfen die Werte der Sensoren höchstens sein
const ONLINE_TIMEOUT = 30;    // ohne neue Messung gilt Gerät / Sensor als "kein Signal"


// Glättung der Position: 0 = keine, 0.8 = sehr stark (träge)
const POSITION_SMOOTHING = 0.5;


// API-Key, mit dem sich die ESP32-Sensoren ausweisen (siehe Backend/.env)
define("SENSOR_API_KEY", getenv("MEDTRACK_API_KEY") ?: "");
