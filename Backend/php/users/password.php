<?php
session_start();
require_once __DIR__ . '/../db.php';
requireLogin();

$data = jsonInput();
$current = (string)($data['currentPassword'] ?? '');
$new = (string)($data['newPassword'] ?? '');

if (strlen($new) < 4) {
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'Das neue Passwort muss mindestens 4 Zeichen lang sein.']);
    exit;
}

$stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();

if (!$user || !password_verify($current, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['success'=>false,'message'=>'Aktuelles Passwort ist falsch.']);
    exit;
}

$stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
$stmt->execute([password_hash($new, PASSWORD_DEFAULT), $_SESSION['user_id']]);
echo json_encode(['success'=>true]);
