#include <stdio.h>
#include <string.h>
#include <sys/param.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_app_desc.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"

#include "reporter.h"
#include "tag_table.h"
#include "wifi.h"

#define JSON_BUFFER_SIZE 2048
#define HTTP_TIMEOUT_MS  5000

static const char *TAG = "report";

/* Antwort des Servers – nur für die Fehlersuche im Log */
typedef struct {
    char data[256];
    int length;
} response_t;

static esp_err_t on_http_event(esp_http_client_event_t *event)
{
    response_t *response = event->user_data;

    if (event->event_id == HTTP_EVENT_ON_DATA && response != NULL) {
        int free_space = (int)sizeof(response->data) - 1 - response->length;
        int copy = MIN(event->data_len, free_space);

        if (copy > 0) {
            memcpy(response->data + response->length, event->data, copy);
            response->length += copy;
            response->data[response->length] = '\0';
        }
    }
    return ESP_OK;
}

/*
 * Baut den JSON-Body, z. B.:
 * {"sensor":"A","fw":"1.0.0","uptime":120,
 *  "readings":[{"tag":"MT-01","mac":"aa:bb:cc:dd:ee:ff","rssi":-63,"n":12}]}
 *
 * Rückgabe: Länge oder -1, wenn der Puffer zu klein ist.
 */
static int build_json(char *buffer, size_t size, const tag_reading_t *readings, size_t count)
{
    int length = snprintf(buffer, size,
                          "{\"sensor\":\"%s\",\"fw\":\"%s\",\"uptime\":%lld,\"readings\":[",
                          CONFIG_MEDTRACK_SENSOR_ID,
                          esp_app_get_description()->version,
                          (long long)(esp_timer_get_time() / 1000000));

    for (size_t i = 0; i < count && length < (int)size; i++) {
        length += snprintf(buffer + length, size - length,
                           "%s{\"tag\":\"%s\",\"mac\":\"%s\",\"rssi\":%d,\"n\":%d}",
                           i > 0 ? "," : "",
                           readings[i].name, readings[i].mac,
                           readings[i].rssi, readings[i].samples);
    }

    if (length < (int)size) {
        length += snprintf(buffer + length, size - length, "]}");
    }

    return length < (int)size ? length : -1;
}

static void send_report(const char *json, int length)
{
    response_t response = { 0 };

    esp_http_client_config_t config = {
        .url = CONFIG_MEDTRACK_SERVER_URL,
        .method = HTTP_METHOD_POST,
        .timeout_ms = HTTP_TIMEOUT_MS,
        .event_handler = on_http_event,
        .user_data = &response,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL) {
        ESP_LOGE(TAG, "HTTP-Client konnte nicht erstellt werden - Server-URL pruefen");
        return;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "X-Api-Key", CONFIG_MEDTRACK_API_KEY);
    esp_http_client_set_post_field(client, json, length);

    esp_err_t err = esp_http_client_perform(client);

    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Server nicht erreichbar (%s) - laeuft docker compose, stimmt die IP?",
                 esp_err_to_name(err));
    } else {
        int status = esp_http_client_get_status_code(client);

        if (status == 200) {
            ESP_LOGI(TAG, "Gesendet (HTTP 200)");

            /* Server meldet Tags, die keinem Gerät zugeordnet sind */
            if (strstr(response.data, "\"unknown\":[\"") != NULL) {
                ESP_LOGW(TAG, "Unbekannte Tags - in der Tabelle devices als tag_id eintragen: %s",
                         response.data);
            }
        } else if (status == 401) {
            ESP_LOGE(TAG, "API-Key abgelehnt (401) - muss mit MEDTRACK_API_KEY in Backend/.env uebereinstimmen");
        } else {
            ESP_LOGE(TAG, "Server antwortet mit HTTP %d: %s", status, response.data);
        }
    }

    esp_http_client_cleanup(client);
}

static void reporter_task(void *arg)
{
    static tag_reading_t readings[TAG_TABLE_MAX_TAGS];
    static char json[JSON_BUFFER_SIZE];

    while (true) {
        vTaskDelay(pdMS_TO_TICKS(CONFIG_MEDTRACK_REPORT_INTERVAL_MS));

        if (!wifi_is_connected()) {
            continue;
        }

        size_t count = tag_table_snapshot(readings, TAG_TABLE_MAX_TAGS,
                                          CONFIG_MEDTRACK_RSSI_WINDOW_MS,
                                          CONFIG_MEDTRACK_MIN_SAMPLES);

        for (size_t i = 0; i < count; i++) {
            ESP_LOGI(TAG, "%-8s %s  RSSI %4d dBm  (%d Werte)",
                     readings[i].name[0] ? readings[i].name : "-",
                     readings[i].mac, readings[i].rssi, readings[i].samples);
        }

        /* auch ohne Tags senden – dient dem Backend als Lebenszeichen */
        int length = build_json(json, sizeof(json), readings, count);
        if (length < 0) {
            ESP_LOGE(TAG, "JSON-Puffer zu klein");
            continue;
        }

        send_report(json, length);
    }
}

void reporter_start(void)
{
    xTaskCreate(reporter_task, "reporter", 6144, NULL, 5, NULL);
}
