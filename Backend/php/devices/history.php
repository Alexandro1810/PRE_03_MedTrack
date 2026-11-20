<?php

require_once __DIR__ . "/../database.php";

require_login();


// optional: ?device_id=3 -> nur der Verlauf eines Geräts
$deviceId = int_param($_GET, "device_id");


$sql =
    "SELECT h.id, h.action,
            EXTRACT(EPOCH FROM h.created_at)::BIGINT AS created_at,
            d.id AS device_id, d.name AS device_name,
            u.username
     FROM device_history h
     JOIN devices d ON d.id = h.device_id
     LEFT JOIN users u ON u.id = h.user_id";

$params = [];

if ($deviceId !== null) {
    $sql .= " WHERE h.device_id = ?";
    $params[] = $deviceId;
}

$sql .= " ORDER BY h.created_at DESC, h.id DESC LIMIT 50";


$stmt = db()->prepare($sql);

$stmt->execute($params);


$history = array_map(function (array $h) {

    return [
        "id" => (int) $h["id"],
        "action" => $h["action"],
        "created_at" => (int) $h["created_at"],
        "device_id" => (int) $h["device_id"],
        "device_name" => $h["device_name"],
        "username" => $h["username"]
    ];

}, $stmt->fetchAll());


json_response([
    "success" => true,
    "history" => $history
]);
