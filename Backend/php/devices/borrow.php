<?php
session_start();
require_once __DIR__ . '/../db.php';
requireLogin();

$data = jsonInput();
$id = (int)($data['device_id'] ?? 0);
if ($id <= 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Gerät fehlt.']); exit; }

$stmt = $pdo->prepare('SELECT status FROM devices WHERE id=?');
$stmt->execute([$id]);
$device = $stmt->fetch();
if (!$device) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Gerät nicht gefunden.']); exit; }
if ($device['status'] === 'In Verwendung') { http_response_code(409); echo json_encode(['success'=>false,'message'=>'Gerät ist bereits in Verwendung.']); exit; }

$pdo->beginTransaction();
try {
    $pdo->prepare("UPDATE devices SET status='In Verwendung' WHERE id=?")->execute([$id]);
    $pdo->prepare("INSERT INTO device_history (device_id,user_id,action) VALUES (?,?, 'Ausgeliehen')")->execute([$id,$_SESSION['user_id']]);
    $pdo->commit();
    echo json_encode(['success'=>true]);
} catch (Throwable $e) {
    $pdo->rollBack(); http_response_code(500); echo json_encode(['success'=>false,'message'=>'Ausleihe konnte nicht gespeichert werden.']);
}
