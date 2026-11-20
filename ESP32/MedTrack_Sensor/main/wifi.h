#pragma once

#include <stdbool.h>

/* Startet das WLAN im Station-Modus. Bei Verbindungsabbruch wird
 * automatisch neu verbunden. */
void wifi_start(void);

/* true, sobald der Sensor eine IP-Adresse hat */
bool wifi_is_connected(void);
