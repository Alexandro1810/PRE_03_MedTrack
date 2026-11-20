<?php

/* =====================================================
   POSITIONSBERECHNUNG AUS DEN RSSI-WERTEN
===================================================== */

require_once __DIR__ . "/config.php";


// RSSI (dBm) -> geschätzte Entfernung zum Sensor in Metern
function rssi_to_distance(float $rssi): float
{
    $distance = 10 ** ((RSSI_AT_1M - $rssi) / (10 * PATH_LOSS_EXPONENT));

    return min(max($distance, 0.1), 50.0);
}


// Abstand eines Punkts zum Raum (0, wenn der Punkt im Raum liegt)
function distance_outside_room(array $p): float
{
    $dx = max(0.0, -$p[0], $p[0] - ROOM_WIDTH);
    $dy = max(0.0, -$p[1], $p[1] - ROOM_HEIGHT);

    return hypot($dx, $dy);
}


function clamp_to_room(array $p): array
{
    return [
        min(max($p[0], 0.0), ROOM_WIDTH),
        min(max($p[1], 0.0), ROOM_HEIGHT)
    ];
}


/*
    Schnittpunkt der Kreise um zwei Sensoren $a (Radius $ra) und $b (Radius $rb).
    Wird nur verwendet, wenn gerade nur zwei Sensoren das Gerät sehen.

    Zwei Kreise schneiden sich in zwei Punkten, die spiegelbildlich zur
    Linie A–B liegen. Gewählt wird der Punkt im Raum (bzw. der näher an der
    vorherigen Position). Da die RSSI-Werte schwanken, berühren sich die
    Kreise oft nicht – dann wird der nächstliegende Punkt auf der Linie A–B
    verwendet.
*/
function locate(array $a, array $b, float $ra, float $rb, ?array $previous = null): array
{
    $dx = $b["x"] - $a["x"];
    $dy = $b["y"] - $a["y"];
    $d = hypot($dx, $dy);

    if ($d < 0.01) {
        return clamp_to_room([$a["x"], $a["y"]]);
    }

    // Kreise zu klein, um sich zu treffen -> proportional vergrößern
    if ($ra + $rb < $d) {
        $factor = $d / ($ra + $rb);
        $ra *= $factor;
        $rb *= $factor;
    }

    // Abstand von A entlang der Linie A–B bis zur Verbindungslinie der Schnittpunkte
    $l = ($ra * $ra - $rb * $rb + $d * $d) / (2 * $d);

    // halber Abstand der beiden Schnittpunkte
    $h = sqrt(max(0.0, $ra * $ra - $l * $l));

    $mx = $a["x"] + $l * $dx / $d;
    $my = $a["y"] + $l * $dy / $d;

    $candidates = [
        [$mx - $h * $dy / $d, $my + $h * $dx / $d],
        [$mx + $h * $dy / $d, $my - $h * $dx / $d]
    ];

    usort($candidates, function ($p, $q) use ($previous) {

        $outside = distance_outside_room($p) <=> distance_outside_room($q);

        if ($outside !== 0 || $previous === null) {
            return $outside;
        }

        return hypot($p[0] - $previous[0], $p[1] - $previous[1])
            <=> hypot($q[0] - $previous[0], $q[1] - $previous[1]);
    });

    return clamp_to_room($candidates[0]);
}


/*
    Trilateration mit drei (oder mehr) Sensoren.

    Zieht man die Kreisgleichung des ersten Sensors von den anderen ab,
    fallen x² und y² weg und es bleiben lineare Gleichungen
        2(xi − x0)·x + 2(yi − y0)·y = r0² − ri² + xi² − x0² + yi² − y0²
    Diese werden nach der Methode der kleinsten Quadrate gelöst. Passen
    die Radien wegen schwankender RSSI-Werte nicht genau zusammen, liefert
    das trotzdem den Punkt, der am besten zu allen Kreisen passt.

    $circles: Liste von ["x" => .., "y" => .., "r" => ..]
    Rückgabe: [x, y] oder null, wenn die Sensoren auf einer Linie liegen.
*/
function trilaterate(array $circles): ?array
{
    $c0 = $circles[0];

    $m00 = $m01 = $m11 = $v0 = $v1 = 0.0;

    for ($i = 1; $i < count($circles); $i++) {

        $ci = $circles[$i];

        $ax = 2 * ($ci["x"] - $c0["x"]);
        $ay = 2 * ($ci["y"] - $c0["y"]);
        $b = $c0["r"] ** 2 - $ci["r"] ** 2
           + $ci["x"] ** 2 - $c0["x"] ** 2
           + $ci["y"] ** 2 - $c0["y"] ** 2;

        $m00 += $ax * $ax;
        $m01 += $ax * $ay;
        $m11 += $ay * $ay;
        $v0 += $ax * $b;
        $v1 += $ay * $b;
    }

    $det = $m00 * $m11 - $m01 * $m01;

    if (abs($det) < 1e-6) {
        return null;
    }

    return clamp_to_room([
        ($m11 * $v0 - $m01 * $v1) / $det,
        ($m00 * $v1 - $m01 * $v0) / $det
    ]);
}


/*
    Berechnet die Position eines Geräts neu, sobald ein Sensor einen
    neuen Messwert geliefert hat. Mit A, B und C wird trilateriert,
    mit nur zwei Sensoren der passende Kreisschnittpunkt verwendet.
*/
function update_device_position(PDO $db, int $deviceId): void
{
    $stmt = $db->prepare(
        "SELECT r.sensor_id, r.rssi, s.x, s.y
         FROM tag_readings r
         JOIN sensors s ON s.id = r.sensor_id
         WHERE r.device_id = ?
           AND r.measured_at > now() - make_interval(secs => ?)"
    );

    $stmt->execute([$deviceId, READING_MAX_AGE]);

    $readings = [];

    foreach ($stmt->fetchAll() as $row) {
        $readings[$row["sensor_id"]] = $row;
    }

    $rssi = [];
    $distance = [];
    $circles = [];

    foreach (["A", "B", "C"] as $sensorId) {

        $rssi[$sensorId] = isset($readings[$sensorId]) ? (float) $readings[$sensorId]["rssi"] : null;
        $distance[$sensorId] = $rssi[$sensorId] !== null ? rssi_to_distance($rssi[$sensorId]) : null;

        if ($distance[$sensorId] !== null) {
            $circles[] = [
                "x" => (float) $readings[$sensorId]["x"],
                "y" => (float) $readings[$sensorId]["y"],
                "r" => $distance[$sensorId]
            ];
        }
    }

    $signal = [
        $rssi["A"], $rssi["B"], $rssi["C"],
        $distance["A"], $distance["B"], $distance["C"]
    ];


    // Weniger als zwei Sensoren sehen das Gerät -> Signal aktualisieren, Position bleibt
    if (count($circles) < 2) {

        $db->prepare(
            "UPDATE devices
             SET rssi_a = ?, rssi_b = ?, rssi_c = ?,
                 distance_a = ?, distance_b = ?, distance_c = ?, last_seen = now()
             WHERE id = ?"
        )->execute([...$signal, $deviceId]);

        return;
    }


    // vorherige Position für Glättung und Auswahl des Schnittpunkts
    $stmt = $db->prepare(
        "SELECT x, y,
                last_seen > now() - make_interval(secs => ?) AS recent
         FROM devices
         WHERE id = ?"
    );

    $stmt->execute([ONLINE_TIMEOUT, $deviceId]);

    $device = $stmt->fetch();

    $previous = null;

    if ($device && $device["recent"] && $device["x"] !== null && $device["y"] !== null) {
        $previous = [(float) $device["x"], (float) $device["y"]];
    }


    $position = count($circles) >= 3 ? trilaterate($circles) : null;

    // nur zwei Sensoren (oder A, B, C auf einer Linie) -> Kreisschnittpunkt
    if ($position === null) {
        $position = locate($circles[0], $circles[1], $circles[0]["r"], $circles[1]["r"], $previous);
    }

    [$x, $y] = $position;

    if ($previous !== null) {
        $x = POSITION_SMOOTHING * $previous[0] + (1 - POSITION_SMOOTHING) * $x;
        $y = POSITION_SMOOTHING * $previous[1] + (1 - POSITION_SMOOTHING) * $y;
    }


    $db->prepare(
        "UPDATE devices
         SET x = ?, y = ?,
             rssi_a = ?, rssi_b = ?, rssi_c = ?,
             distance_a = ?, distance_b = ?, distance_c = ?, last_seen = now()
         WHERE id = ?"
    )->execute([$x, $y, ...$signal, $deviceId]);


    // Standortverlauf
    $db->prepare(
        "INSERT INTO sensor_data
            (device_id, rssi_a, rssi_b, rssi_c, distance_a, distance_b, distance_c, x, y)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([$deviceId, ...$signal, $x, $y]);
}
