<?php

/* =====================================================
   EMPFANG DER MESSWERTE VON DEN ESP32-SENSOREN

   POST /api/sensors/report.php
   Header:  X-Api-Key: <MEDTRACK_API_KEY>
   Body:    {
              "sensor": "A",
              "fw": "1.0.0",
              "readings": [
                { "tag": "MT-01", "mac": "aa:bb:cc:dd:ee:ff", "rssi": -63, "n": 12 }
              ]
            }

   Ein leeres "readings"-Array ist erlaubt (Lebenszeichen).
===================================================== */

require_once __DIR__ . "/../database.php";
require_once __DIR__ . "/../positioning.php";

require_method("POST");


// Sensor authentifizieren
$apiKey = $_SERVER["HTTP_X_API_KEY"] ?? "";

if (SENSOR_API_KEY === "" || !hash_equals(SENSOR_API_KEY, $apiKey)) {

    json_response([
        "success" => false,
        "message" => "Ungültiger API-Key."
    ], 401);
}


$body = json_decode(file_get_contents("php://input"), true);

$sensorId = strtoupper(trim((string) ($body["sensor"] ?? "")));
$readings = $body["readings"] ?? null;


if ($sensorId === "" || !is_array($readings)) {

    json_response([
        "success" => false,
        "message" => "Erwartet JSON mit \"sensor\" und \"readings\"."
    ], 400);
}


$db = db();


// Lebenszeichen des Sensors speichern
$stmt = $db->prepare(
    "UPDATE sensors
     SET last_seen = now(), ip = ?, firmware = ?
     WHERE id = ?"
);

$stmt->execute([
    $_SERVER["REMOTE_ADDR"] ?? null,
    substr((string) ($body["fw"] ?? ""), 0, 20),
    $sensorId
]);


if ($stmt->rowCount() === 0) {

    json_response([
        "success" => false,
        "message" => "Unbekannter Sensor \"$sensorId\"."
    ], 404);
}


// Tag über den BLE-Namen oder die MAC-Adresse einem Gerät zuordnen
$findDevice = $db->prepare(
    "SELECT id
     FROM devices
     WHERE tag_id = ? OR lower(tag_id) = lower(?)
     LIMIT 1"
);

$saveReading = $db->prepare(
    "INSERT INTO tag_readings (device_id, sensor_id, rssi, samples, measured_at)
     VALUES (?, ?, ?, ?, now())
     ON CONFLICT (device_id, sensor_id)
     DO UPDATE SET rssi = EXCLUDED.rssi,
                   samples = EXCLUDED.samples,
                   measured_at = EXCLUDED.measured_at"
);


$updated = 0;
$unknown = [];


foreach ($readings as $reading) {

    $tag = trim((string) ($reading["tag"] ?? ""));
    $mac = trim((string) ($reading["mac"] ?? ""));
    $rssi = $reading["rssi"] ?? null;

    if (!is_numeric($rssi) || $rssi > 0 || $rssi < -127 || ($tag === "" && $mac === "")) {
        continue;
    }

    $findDevice->execute([$tag, $mac]);

    $deviceId = $findDevice->fetchColumn();

    if ($deviceId === false) {
        $unknown[] = $tag !== "" ? $tag : $mac;
        continue;
    }

    $saveReading->execute([
        $deviceId,
        $sensorId,
        (float) $rssi,
        max(1, (int) ($reading["n"] ?? 1))
    ]);

    update_device_position($db, (int) $deviceId);

    $updated++;
}


json_response([
    "success" => true,
    "updated" => $updated,
    "unknown" => $unknown
]);
