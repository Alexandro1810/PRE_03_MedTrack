<?php
session_start();
require_once __DIR__ . '/../db.php';
requireLogin();

$data = jsonInput();
$title = trim($data['title'] ?? '');
$description = trim($data['description'] ?? '');
$date = $data['date'] ?? '';
$time = $data['time'] ?? '';
$type = $data['type'] ?? 'Termin';
$deviceId = !empty($data['device_id']) ? (int)$data['device_id'] : null;

if ($title === '' || $date === '' || $time === '') { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Titel, Datum und Uhrzeit sind erforderlich.']); exit; }
if (!in_array($type,['Wartung','Ausleihe','Termin','Sonstiges'],true)) $type='Termin';

$stmt = $pdo->prepare('INSERT INTO calendar_events (title,description,event_date,event_time,event_type,device_id,user_id) VALUES (?,?,?,?,?,?,?)');
$stmt->execute([$title,$description,$date,$time,$type,$deviceId,$_SESSION['user_id']]);
echo json_encode(['success'=>true,'id'=>(int)$pdo->lastInsertId()]);
