<?php
session_start();
require_once __DIR__ . '/../db.php';
requireLogin();

$data = jsonInput();
$id = (int)($data['id'] ?? 0);
if ($id <= 0) { http_response_code(400); echo json_encode(['success'=>false]); exit; }

if ($_SESSION['role'] === 'Administrator') {
    $stmt = $pdo->prepare('DELETE FROM calendar_events WHERE id=?');
    $stmt->execute([$id]);
} else {
    $stmt = $pdo->prepare('DELETE FROM calendar_events WHERE id=? AND user_id=?');
    $stmt->execute([$id,$_SESSION['user_id']]);
}

echo json_encode(['success'=>true]);
