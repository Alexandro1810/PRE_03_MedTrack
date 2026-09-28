<?php
session_start();
require_once __DIR__ . '/../db.php';
requireAdmin();

$data = jsonInput();
$name = trim($data['name'] ?? '');
$type = trim($data['type'] ?? '');
if ($name === '' || $type === '') { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Name und Typ sind erforderlich.']); exit; }
$stmt = $pdo->prepare('INSERT INTO devices (name,type,status,x,y) VALUES (?,? ,\'Online\',0,0)');
$stmt->execute([$name,$type]);
echo json_encode(['success'=>true,'id'=>(int)$pdo->lastInsertId()]);
