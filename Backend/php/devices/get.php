<?php

require_once __DIR__ . "/../database.php";

require_login();


$stmt = db()->query(
    "SELECT d.id, d.name, d.type, d.tag_id, d.status,
            u.username AS borrowed_by,
            EXTRACT(EPOCH FROM d.borrowed_at)::BIGINT AS borrowed_at,
            d.x, d.y,
            d.rssi_a, d.rssi_b, d.rssi_c,
            d.distance_a, d.distance_b, d.distance_c,
            EXTRACT(EPOCH FROM (now() - d.last_seen))::INTEGER AS seconds_ago
     FROM devices d
     LEFT JOIN users u ON u.id = d.borrowed_by
     ORDER BY d.name"
);


$devices = array_map(function (array $d) {

    $secondsAgo = to_int($d["seconds_ago"]);

    return [
        "id" => (int) $d["id"],
        "name" => $d["name"],
        "type" => $d["type"],
        "tag_id" => $d["tag_id"],
        "status" => $d["status"],
        "borrowed_by" => $d["borrowed_by"],
        "borrowed_at" => to_int($d["borrowed_at"]),
        "x" => to_float($d["x"]),
        "y" => to_float($d["y"]),
        "rssi_a" => to_float($d["rssi_a"]),
        "rssi_b" => to_float($d["rssi_b"]),
        "rssi_c" => to_float($d["rssi_c"]),
        "distance_a" => to_float($d["distance_a"]),
        "distance_b" => to_float($d["distance_b"]),
        "distance_c" => to_float($d["distance_c"]),
        "seconds_ago" => $secondsAgo,
        "online" => $secondsAgo !== null && $secondsAgo <= ONLINE_TIMEOUT
    ];

}, $stmt->fetchAll());


json_response([
    "success" => true,
    "devices" => $devices
]);
