<?php

require_once __DIR__ . "/../helpers.php";


start_session();


if (!isset($_SESSION["user_id"])) {

    json_response([
        "success" => false,
        "loggedIn" => false
    ], 401);
}


json_response([
    "success" => true,
    "loggedIn" => true,

    "user" => [
        "id" => $_SESSION["user_id"],
        "username" => $_SESSION["username"],
        "role" => $_SESSION["role"]
    ]
]);
