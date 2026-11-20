<?php

require_once __DIR__ . "/../database.php";

require_method("POST");

$user = require_login();


$deviceId = int_param($_POST, "device_id");


if ($deviceId === null) {

    json_response([
        "success" => false,
        "message" => "Keine gültige Geräte-ID angegeben."
    ], 400);
}


$db = db();

$db->beginTransaction();


// Zeile sperren, damit nicht zwei Personen gleichzeitig ausleihen
$stmt = $db->prepare(
    "SELECT name, status
     FROM devices
     WHERE id = ?
     FOR UPDATE"
);

$stmt->execute([$deviceId]);

$device = $stmt->fetch();


if (!$device) {

    $db->rollBack();

    json_response([
        "success" => false,
        "message" => "Gerät nicht gefunden."
    ], 404);
}


if ($device["status"] !== "Verfügbar") {

    $db->rollBack();

    json_response([
        "success" => false,
        "message" => "{$device["name"]} ist derzeit nicht verfügbar ({$device["status"]})."
    ], 409);
}


$db->prepare(
    "UPDATE devices
     SET status = 'Ausgeliehen', borrowed_by = ?, borrowed_at = now()
     WHERE id = ?"
)->execute([$user["id"], $deviceId]);


$db->prepare(
    "INSERT INTO device_history (device_id, user_id, action)
     VALUES (?, ?, 'Ausgeliehen')"
)->execute([$deviceId, $user["id"]]);


$db->commit();


json_response([
    "success" => true,
    "message" => "{$device["name"]} wurde ausgeliehen."
]);
