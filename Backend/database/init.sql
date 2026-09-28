CREATE DATABASE IF NOT EXISTS medtrack;
USE medtrack;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Administrator','Benutzer') NOT NULL DEFAULT 'Benutzer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status ENUM('Online','Offline','Verfügbar','In Verwendung','Wartung') NOT NULL DEFAULT 'Online',
    x DECIMAL(6,2) NOT NULL DEFAULT 0,
    y DECIMAL(6,2) NOT NULL DEFAULT 0,
    rssi_a INT NULL,
    rssi_b INT NULL,
    distance_a DECIMAL(6,2) NULL,
    distance_b DECIMAL(6,2) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    user_id INT NULL,
    action ENUM('Ausgeliehen','Zurückgegeben','Position aktualisiert','Status geändert') NOT NULL,
    note VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS calendar_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    event_type ENUM('Wartung','Ausleihe','Termin','Sonstiges') NOT NULL DEFAULT 'Termin',
    device_id INT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO devices (name, type, status, x, y, rssi_a, rssi_b, distance_a, distance_b)
SELECT 'EKG #01','EKG-Gerät','Online',7.32,5.28,-58,-69,4.10,6.30
WHERE NOT EXISTS (SELECT 1 FROM devices WHERE name='EKG #01');

INSERT INTO devices (name, type, status, x, y, rssi_a, rssi_b, distance_a, distance_b)
SELECT 'Pumpe #02','Infusionspumpe','Online',9.36,7.70,-71,-52,7.40,3.80
WHERE NOT EXISTS (SELECT 1 FROM devices WHERE name='Pumpe #02');
