<?php
session_start();
require_once __DIR__ . '/../db.php';
requireAdmin();

$data = jsonInput();
$id = (int)($data['id'] ?? 0);
if ($id <= 0 || $id === (int)$_SESSION['user_id']) {
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'Ungültiger Benutzer oder der eigene Account darf nicht gelöscht werden.']);
    exit;
}

$stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
$stmt->execute([$id]);
echo json_encode(['success'=>true]);
