<?php
session_start();
require_once __DIR__ . '/../db.php';
requireLogin();

$id = (int)($_GET['device_id'] ?? 0);
if ($id <= 0) { http_response_code(400); echo json_encode(['success'=>false]); exit; }

$stmt = $pdo->prepare('SELECT h.*, u.username FROM device_history h LEFT JOIN users u ON u.id=h.user_id WHERE h.device_id=? ORDER BY h.created_at DESC');
$stmt->execute([$id]);
echo json_encode(['success'=>true,'history'=>$stmt->fetchAll()]);
