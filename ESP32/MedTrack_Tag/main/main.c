/*
 * MedTrack Tag – ESP32 als BLE-Tag zum Testen
 *
 * Sendet dauerhaft nicht verbindbare Advertising-Pakete mit dem
 * eingestellten Namen (z. B. "MT-01"). Die MedTrack-Sensoren erkennen
 * den Tag am Namens-Prefix und messen seine Signalstärke.
 *
 * Einstellungen: idf.py menuconfig -> "MedTrack Tag"
 */

#include <string.h>

#include "esp_bt.h"
#include "esp_log.h"
#include "nvs_flash.h"

#include "host/ble_hs.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"

static const char *TAG = "medtrack_tag";

static int on_gap_event(struct ble_gap_event *event, void *arg)
{
    return 0;
}

static void start_advertising(void)
{
    uint8_t own_addr_type;

    if (ble_hs_id_infer_auto(0, &own_addr_type) != 0) {
        ESP_LOGE(TAG, "Adresstyp konnte nicht bestimmt werden");
        return;
    }

    /* Inhalt des Advertising-Pakets: Flags, Name und Sendeleistung */
    struct ble_hs_adv_fields fields = { 0 };
    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
    fields.name = (const uint8_t *)CONFIG_MEDTRACK_TAG_NAME;
    fields.name_len = strlen(CONFIG_MEDTRACK_TAG_NAME);
    fields.name_is_complete = 1;
    fields.tx_pwr_lvl = BLE_HS_ADV_TX_PWR_LVL_AUTO;
    fields.tx_pwr_lvl_is_present = 1;

    int rc = ble_gap_adv_set_fields(&fields);
    if (rc != 0) {
        ESP_LOGE(TAG, "Advertising-Daten ungueltig (rc=%d) - Name zu lang?", rc);
        return;
    }

    struct ble_gap_adv_params params = {
        .conn_mode = BLE_GAP_CONN_MODE_NON,  /* nicht verbindbar */
        .disc_mode = BLE_GAP_DISC_MODE_GEN,
        .itvl_min = BLE_GAP_ADV_ITVL_MS(CONFIG_MEDTRACK_ADV_INTERVAL_MS),
        .itvl_max = BLE_GAP_ADV_ITVL_MS(CONFIG_MEDTRACK_ADV_INTERVAL_MS),
    };

    rc = ble_gap_adv_start(own_addr_type, NULL, BLE_HS_FOREVER, &params, on_gap_event, NULL);
    if (rc != 0) {
        ESP_LOGE(TAG, "Advertising konnte nicht gestartet werden (rc=%d)", rc);
        return;
    }

    uint8_t addr[6];
    ble_hs_id_copy_addr(own_addr_type, addr, NULL);

    ESP_LOGI(TAG, "Sende als \"%s\" alle %d ms, MAC %02x:%02x:%02x:%02x:%02x:%02x",
             CONFIG_MEDTRACK_TAG_NAME, CONFIG_MEDTRACK_ADV_INTERVAL_MS,
             addr[5], addr[4], addr[3], addr[2], addr[1], addr[0]);
}

static void on_sync(void)
{
    if (ble_hs_util_ensure_addr(0) != 0) {
        ESP_LOGE(TAG, "Keine BLE-Adresse verfuegbar");
        return;
    }
    start_advertising();
}

static void on_reset(int reason)
{
    ESP_LOGW(TAG, "BLE-Stack zurueckgesetzt (Grund %d)", reason);
}

static void host_task(void *param)
{
    nimble_port_run();
    nimble_port_freertos_deinit();
}

void app_main(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    ESP_ERROR_CHECK(nimble_port_init());

#if defined(CONFIG_IDF_TARGET_ESP32) || defined(CONFIG_IDF_TARGET_ESP32C3) || defined(CONFIG_IDF_TARGET_ESP32S3)
    /* Feste Sendeleistung, damit alle Tags vergleichbare RSSI-Werte liefern */
    esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_ADV, ESP_PWR_LVL_P3);
#endif

    ble_hs_cfg.sync_cb = on_sync;
    ble_hs_cfg.reset_cb = on_reset;

    nimble_port_freertos_init(host_task);
}
