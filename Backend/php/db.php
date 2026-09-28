<?php
header('Content-Type: application/json; charset=utf-8');

$host = getenv('DB_HOST') ?: 'db';
$dbname = getenv('DB_NAME') ?: 'medtrack';
$user = getenv('DB_USER') ?: 'medtrack_user';
$password = getenv('DB_PASSWORD') ?: 'medtrack_pass';

try {
    $pdo = new PDO(
        "mysql:host={$host};dbname={$dbname};charset=utf8mb4",
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Datenbankverbindung fehlgeschlagen.']);
    exit;
}

function requireLogin(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    if (empty($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success'=>false,'message'=>'Nicht angemeldet.']);
        exit;
    }
}

function requireAdmin(): void {
    requireLogin();
    if (($_SESSION['role'] ?? '') !== 'Administrator') {
        http_response_code(403);
        echo json_encode(['success'=>false,'message'=>'Nur Administratoren dürfen diese Aktion ausführen.']);
        exit;
    }
}

function jsonInput(): array {
    $raw = file_get_contents('php://input');
    if ($raw) {
        $data = json_decode($raw, true);
        if (is_array($data)) return $data;
    }
    return $_POST;
}
