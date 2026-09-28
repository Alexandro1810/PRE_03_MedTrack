<?php
session_start();
require_once __DIR__ . '/../db.php';
requireAdmin();

$data = jsonInput();
$username = trim($data['username'] ?? '');
$password = (string)($data['password'] ?? '');
$role = $data['role'] ?? 'Benutzer';

if ($username === '' || strlen($username) > 100 || strlen($password) < 4) {
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'Benutzername und ein Passwort mit mindestens 4 Zeichen sind erforderlich.']);
    exit;
}
if (!in_array($role, ['Administrator','Benutzer'], true)) $role = 'Benutzer';

try {
    $stmt = $pdo->prepare('INSERT INTO users (username,password_hash,role) VALUES (?,?,?)');
    $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), $role]);
    echo json_encode(['success'=>true,'id'=>(int)$pdo->lastInsertId()]);
} catch (PDOException $e) {
    http_response_code(409);
    echo json_encode(['success'=>false,'message'=>'Dieser Benutzername existiert bereits.']);
}
