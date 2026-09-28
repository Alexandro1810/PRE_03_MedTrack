<?php
session_start();
require_once __DIR__ . '/../db.php';

$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'Bitte Benutzername und Passwort eingeben.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id,username,password_hash,role FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['success'=>false,'message'=>'Benutzername oder Passwort falsch.']);
    exit;
}

session_regenerate_id(true);
$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['username'] = $user['username'];
$_SESSION['role'] = $user['role'];

echo json_encode(['success'=>true,'user'=>['id'=>(int)$user['id'],'username'=>$user['username'],'role'=>$user['role']]]);
