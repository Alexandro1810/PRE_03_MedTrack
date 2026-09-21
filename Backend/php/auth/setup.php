<?php

require_once 'database.php';

$username = "admin";
$password = "medtrack";
$role = "Administrator";

$hash =
    password_hash(
        $password,
        PASSWORD_DEFAULT
    );

$stmt = $db->prepare(
    "INSERT INTO users
    (username, password_hash, role)
    VALUES (?, ?, ?)"
);

$stmt->execute([
    $username,
    $hash,
    $role
]);

echo "Benutzer wurde erstellt.";