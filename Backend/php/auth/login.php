<?php

session_start();

header(
    'Content-Type: application/json; charset=utf-8'
);

require_once 'database.php';

$username =
    trim($_POST['username'] ?? '');

$password =
    $_POST['password'] ?? '';

$stmt = $db->prepare(
    'SELECT * FROM users WHERE username = ?'
);

$stmt->execute([$username]);

$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (
    !$user ||
    !password_verify(
        $password,
        $user['password_hash']
    )
) {

    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' =>
            'Benutzername oder Passwort falsch.'
    ]);

    exit;
}

session_regenerate_id(true);

$_SESSION['user_id'] =
    $user['id'];

$_SESSION['username'] =
    $user['username'];

$_SESSION['role'] =
    $user['role'];

echo json_encode([
    'success' => true,
    'username' =>
        $user['username'],
    'role' =>
        $user['role']
]);