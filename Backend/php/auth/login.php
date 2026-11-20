<?php

require_once __DIR__ . "/../database.php";

require_method("POST");

start_session();


$username = trim($_POST["username"] ?? "");
$password = $_POST["password"] ?? "";


if ($username === "" || $password === "") {

    json_response([
        "success" => false,
        "message" => "Benutzername und Passwort erforderlich."
    ], 400);
}


$stmt = db()->prepare(
    "SELECT id, username, password_hash, role
     FROM users
     WHERE username = ?"
);

$stmt->execute([$username]);

$user = $stmt->fetch();


if (
    !$user ||
    !password_verify(
        $password,
        $user["password_hash"]
    )
) {

    json_response([
        "success" => false,
        "message" => "Benutzername oder Passwort falsch."
    ], 401);
}


session_regenerate_id(true);


$_SESSION["user_id"] = (int) $user["id"];
$_SESSION["username"] = $user["username"];
$_SESSION["role"] = $user["role"];


json_response([
    "success" => true,
    "user" => [
        "id" => (int) $user["id"],
        "username" => $user["username"],
        "role" => $user["role"]
    ]
]);
