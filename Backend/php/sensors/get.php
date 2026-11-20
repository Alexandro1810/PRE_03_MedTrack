<?php

require_once __DIR__ . "/../database.php";

require_login();


$stmt = db()->query(
    "SELECT id, name, x, y, ip, firmware,
            EXTRACT(EPOCH FROM (now() - last_seen))::INTEGER AS seconds_ago
     FROM sensors
     ORDER BY id"
);


$sensors = array_map(function (array $s) {

    $secondsAgo = to_int($s["seconds_ago"]);

    return [
        "id" => $s["id"],
        "name" => $s["name"],
        "x" => (float) $s["x"],
        "y" => (float) $s["y"],
        "ip" => $s["ip"],
        "firmware" => $s["firmware"],
        "seconds_ago" => $secondsAgo,
        "online" => $secondsAgo !== null && $secondsAgo <= ONLINE_TIMEOUT
    ];

}, $stmt->fetchAll());


json_response([
    "success" => true,

    "room" => [
        "station" => STATION_NAME,
        "name" => ROOM_NAME,
        "width" => ROOM_WIDTH,
        "height" => ROOM_HEIGHT
    ],

    "sensors" => $sensors
]);
