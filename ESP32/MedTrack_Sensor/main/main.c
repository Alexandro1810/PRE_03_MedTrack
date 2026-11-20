/*
 * MedTrack Sensor – Firmware für die fest montierten ESP32 (Sensor A / B / C)
 *
 * Ablauf:
 *   1. WLAN verbinden                               (wifi.c)
 *   2. dauerhaft nach BLE-Tags scannen,
 *      RSSI-Werte je Tag sammeln                    (ble_scanner.c, tag_table.c)
 *   3. alle 2 s den RSSI-Median je Tag per HTTP
 *      an das Backend schicken                      (reporter.c)
 *
 * Die Entfernung und Position berechnet das Backend
 * (Backend/php/positioning.php), damit man zum Kalibrieren
 * nicht jedes Mal neu flashen muss.
 *
 * Einstellungen: idf.py menuconfig -> "MedTrack Sensor"
 */

#include "esp_log.h"
#include "nvs_flash.h"

#include "ble_scanner.h"
#include "reporter.h"
#include "tag_table.h"
#include "wifi.h"

static const char *TAG = "medtrack";

void app_main(void)
{
    ESP_LOGI(TAG, "MedTrack Sensor %s startet", CONFIG_MEDTRACK_SENSOR_ID);

    /* NVS wird von WLAN und Bluetooth für Kalibrierdaten benötigt */
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    tag_table_init();
    wifi_start();
    ble_scanner_start();
    reporter_start();
}
