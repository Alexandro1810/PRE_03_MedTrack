<?php

/* =====================================================
   DATENBANKVERBINDUNG (PostgreSQL)
   Zugangsdaten kommen aus Backend/.env (docker-compose)
===================================================== */

require_once __DIR__ . "/helpers.php";


function db(): PDO
{
    static $db = null;

    if ($db !== null) {
        return $db;
    }

    $host = getenv("DB_HOST") ?: "db";
    $port = getenv("DB_PORT") ?: "5432";
    $name = getenv("POSTGRES_DB") ?: "medtrack";
    $user = getenv("POSTGRES_USER") ?: "medtrack";
    $password = getenv("POSTGRES_PASSWORD") ?: "medtrack";

    try {

        $db = new PDO(
            "pgsql:host=$host;port=$port;dbname=$name;options='--client_encoding=UTF8'",
            $user,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]
        );

    } catch (PDOException $e) {

        error_log("MedTrack DB: " . $e->getMessage());

        json_response([
            "success" => false,
            "message" => "Datenbankverbindung fehlgeschlagen."
        ], 500);
    }

    return $db;
}
