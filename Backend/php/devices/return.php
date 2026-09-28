<?php
session_start();
require_once __DIR__ . '/../db.php';
requireLogin();

$data = jsonInput();
$id = (int)($data['device_id'] ?? 0);
if ($id <= 0) { http_response_code(400); echo json_encode(['success'=>false]); exit; }

$pdo->beginTransaction();
try {
    $pdo->prepare("UPDATE devices SET status='Verfügbar' WHERE id=?")->execute([$id]);
    $pdo->prepare("INSERT INTO device_history (device_id,user_id,action) VALUES (?,?, 'Zurückgegeben')")->execute([$id,$_SESSION['user_id']]);
    $pdo->commit();
    echo json_encode(['success'=>true]);
} catch (Throwable $e) {
    $pdo->rollBack(); http_response_code(500); echo json_encode(['success'=>false,'message'=>'Rückgabe konnte nicht gespeichert werden.']);
}
