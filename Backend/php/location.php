<?php
session_start();
require_once __DIR__ . '/db.php';
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    requireLogin();
    $stmt = $pdo->query('SELECT id,name,x,y,rssi_a,rssi_b,distance_a,distance_b,updated_at FROM devices ORDER BY id');
    echo json_encode(['success'=>true,'locations'=>$stmt->fetchAll()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $apiKey = $_SERVER['HTTP_X_ESP32_KEY'] ?? '';
    $expectedKey = getenv('ESP32_API_KEY') ?: 'medtrack-esp32-demo';
    if ($apiKey !== $expectedKey) {
        requireLogin();
    }
    $data = jsonInput();
    $id = (int)($data['device_id'] ?? 0);
    if ($id <= 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'device_id fehlt.']); exit; }
    $stmt = $pdo->prepare('UPDATE devices SET x=?, y=?, rssi_a=?, rssi_b=?, distance_a=?, distance_b=? WHERE id=?');
    $stmt->execute([
        (float)($data['x'] ?? 0), (float)($data['y'] ?? 0),
        isset($data['rssi_a']) ? (int)$data['rssi_a'] : null,
        isset($data['rssi_b']) ? (int)$data['rssi_b'] : null,
        isset($data['distance_a']) ? (float)$data['distance_a'] : null,
        isset($data['distance_b']) ? (float)$data['distance_b'] : null,
        $id
    ]);
    echo json_encode(['success'=>true]);
    exit;
}

http_response_code(405);
echo json_encode(['success'=>false,'message'=>'Methode nicht erlaubt.']);
