<?php
session_start();
require_once __DIR__ . '/../db.php';
requireLogin();

$stmt = $pdo->query('SELECT e.*, d.name AS device_name, u.username AS created_by FROM calendar_events e LEFT JOIN devices d ON d.id=e.device_id LEFT JOIN users u ON u.id=e.user_id ORDER BY e.event_date, e.event_time');
echo json_encode(['success'=>true,'events'=>$stmt->fetchAll()]);
