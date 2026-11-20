#pragma once

/* Startet einen Task, der regelmäßig die gemessenen RSSI-Werte
 * per HTTP-POST an das Backend schickt (Backend/php/sensors/report.php). */
void reporter_start(void);
