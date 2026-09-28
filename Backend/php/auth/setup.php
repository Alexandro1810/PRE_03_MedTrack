<?php
session_start();
require_once __DIR__ . '/../db.php';

$users = [
    ['admin', 'medtrack', 'Administrator'],
    ['Alex', 'Wöhrer', 'Benutzer'],
    ['Julian', 'Tschiltsch', 'Benutzer'],
    ['Leon', 'Parzer', 'Benutzer'],
];

$created = [];
$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
$insert = $pdo->prepare('INSERT INTO users (username,password_hash,role) VALUES (?,?,?)');

foreach ($users as [$username,$password,$role]) {
    $stmt->execute([$username]);
    if (!$stmt->fetch()) {
        $insert->execute([$username, password_hash($password, PASSWORD_DEFAULT), $role]);
        $created[] = $username;
    }
}

echo json_encode(['success'=>true,'created'=>$created,'message'=>'Basisbenutzer geprüft/angelegt.']);
