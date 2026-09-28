<?php
session_start();
require_once __DIR__ . '/../db.php';
requireLogin();

$stmt = $pdo->query('SELECT * FROM devices ORDER BY name');
echo json_encode(['success'=>true,'devices'=>$stmt->fetchAll()]);
