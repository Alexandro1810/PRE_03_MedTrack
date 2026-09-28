<?php
session_start();
require_once __DIR__ . '/../db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['loggedIn'=>false]);
    exit;
}

echo json_encode(['loggedIn'=>true,'user'=>[
    'id'=>(int)$_SESSION['user_id'],
    'username'=>$_SESSION['username'],
    'role'=>$_SESSION['role']
]]);
