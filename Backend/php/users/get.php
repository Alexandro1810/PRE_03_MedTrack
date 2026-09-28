<?php
session_start();
require_once __DIR__ . '/../db.php';
requireAdmin();

$stmt = $pdo->query('SELECT id, username, role, created_at FROM users ORDER BY username');
echo json_encode(['success'=>true,'users'=>$stmt->fetchAll()]);
