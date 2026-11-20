#pragma once

/* Startet den NimBLE-Stack und scannt dauerhaft nach BLE-Tags.
 * Erkannte Tags landen mit ihrem RSSI in der Tag-Tabelle (tag_table.h). */
void ble_scanner_start(void);
