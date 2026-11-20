<?php

require_once __DIR__ . "/../database.php";

require_admin();


$stmt = db()->query(
    "SELECT id, username, role
     FROM users
     ORDER BY id"
);


$users = array_map(function (array $u) {

    return [
        "id" => (int) $u["id"],
        "username" => $u["username"],
        "role" => $u["role"]
    ];

}, $stmt->fetchAll());


json_response([
    "success" => true,
    "users" => $users
]);
