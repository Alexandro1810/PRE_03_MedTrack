<?php

require_once __DIR__ . "/../database.php";

require_method("POST");

// Nur Administratoren dürfen Benutzer anlegen
require_admin();


const ROLES = ["User", "Administrator"];


$username = trim($_POST["username"] ?? "");
$password = $_POST["password"] ?? "";
$role = trim($_POST["role"] ?? "User");


if ($username === "" || $password === "") {

    json_response([
        "success" => false,
        "message" => "Benutzername und Passwort erforderlich."
    ], 400);
}


if (strlen($password) < 8) {

    json_response([
        "success" => false,
        "message" => "Das Passwort muss mindestens 8 Zeichen lang sein."
    ], 400);
}


if (!in_array($role, ROLES, true)) {

    json_response([
        "success" => false,
        "message" => "Unbekannte Rolle."
    ], 400);
}


$hash = password_hash(
    $password,
    PASSWORD_DEFAULT
);


try {

    $stmt = db()->prepare(
        "INSERT INTO users
        (username, password_hash, role)
        VALUES (?, ?, ?)"
    );

    $stmt->execute([
        $username,
        $hash,
        $role
    ]);

} catch (PDOException $e) {

    // 23505 = unique_violation
    if ($e->getCode() === "23505") {

        json_response([
            "success" => false,
            "message" => "Benutzername ist bereits vergeben."
        ], 409);
    }

    throw $e;
}


json_response([
    "success" => true,
    "message" => "Benutzer wurde erstellt."
]);
