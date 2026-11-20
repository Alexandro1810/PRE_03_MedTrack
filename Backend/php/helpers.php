<?php

/* =====================================================
   GEMEINSAME HILFSFUNKTIONEN FÜR ALLE API-ENDPUNKTE
===================================================== */

require_once __DIR__ . "/config.php";


// Unerwartete Fehler (z. B. SQL-Fehler) immer als JSON beantworten,
// damit das Frontend nicht an einer HTML-Fehlerseite scheitert.
set_exception_handler(function (Throwable $e) {

    error_log("MedTrack API: " . $e);

    json_response([
        "success" => false,
        "message" => "Interner Serverfehler."
    ], 500);
});


function json_response(array $data, int $status = 200): never
{
    http_response_code($status);

    header("Content-Type: application/json; charset=utf-8");

    echo json_encode($data, JSON_UNESCAPED_UNICODE);

    exit;
}


function require_method(string $method): void
{
    if ($_SERVER["REQUEST_METHOD"] !== $method) {

        header("Allow: $method");

        json_response([
            "success" => false,
            "message" => "Methode nicht erlaubt."
        ], 405);
    }
}


function start_session(): void
{
    if (session_status() === PHP_SESSION_NONE) {

        session_set_cookie_params([
            "httponly" => true,
            "samesite" => "Strict"
        ]);

        session_start();
    }
}


// Bricht mit 401 ab, wenn niemand eingeloggt ist.
function require_login(): array
{
    start_session();

    if (!isset($_SESSION["user_id"])) {

        json_response([
            "success" => false,
            "message" => "Nicht eingeloggt."
        ], 401);
    }

    return [
        "id" => $_SESSION["user_id"],
        "username" => $_SESSION["username"],
        "role" => $_SESSION["role"]
    ];
}


// Bricht mit 403 ab, wenn der Benutzer kein Administrator ist.
function require_admin(): array
{
    $user = require_login();

    if ($user["role"] !== "Administrator") {

        json_response([
            "success" => false,
            "message" => "Keine Berechtigung."
        ], 403);
    }

    return $user;
}


// Liest eine positive Ganzzahl (z. B. eine ID) aus $_POST / $_GET.
function int_param(array $source, string $key): ?int
{
    $value = filter_var(
        $source[$key] ?? null,
        FILTER_VALIDATE_INT,
        ["options" => ["min_range" => 1]]
    );

    return $value === false ? null : $value;
}


// Wandelt Zahlen aus der Datenbank (PDO liefert oft Strings) in echte Zahlen um.
function to_float($value): ?float
{
    return $value === null ? null : (float) $value;
}

function to_int($value): ?int
{
    return $value === null ? null : (int) $value;
}
