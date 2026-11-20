#include <ctype.h>
#include <stdio.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_timer.h"
#include "esp_wifi.h"

#include "wifi.h"

#define CONNECTED_BIT BIT0

/* Nach so vielen schnellen Fehlversuchen nur noch alle RETRY_DELAY_US probieren,
 * damit der ständige WLAN-Scan nicht den BLE-Empfang stört */
#define FAST_RETRIES   5
#define RETRY_DELAY_US (10 * 1000 * 1000)

static const char *TAG = "wifi";

static EventGroupHandle_t s_events;
static esp_timer_handle_t s_retry_timer;
static int s_retries;

static void reconnect(void *arg)
{
    esp_wifi_connect();
}

static void on_event(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();

    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        const wifi_event_sta_disconnected_t *info = data;

        xEventGroupClearBits(s_events, CONNECTED_BIT);
        s_retries++;

        ESP_LOGW(TAG, "Keine Verbindung zu \"%s\" (Grund %d), Versuch %d",
                 CONFIG_MEDTRACK_WIFI_SSID, info->reason, s_retries);

        if (s_retries <= FAST_RETRIES) {
            esp_wifi_connect();
        } else {
            esp_timer_start_once(s_retry_timer, RETRY_DELAY_US);
        }

    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        const ip_event_got_ip_t *event = data;

        ESP_LOGI(TAG, "Verbunden, IP-Adresse " IPSTR, IP2STR(&event->ip_info.ip));
        s_retries = 0;
        xEventGroupSetBits(s_events, CONNECTED_BIT);
    }
}

void wifi_start(void)
{
    s_events = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    esp_netif_t *netif = esp_netif_create_default_wifi_sta();

    /* Hostname "medtrack-sensor-a" – so findet man den Sensor im Router */
    char hostname[32];
    snprintf(hostname, sizeof(hostname), "medtrack-sensor-%s", CONFIG_MEDTRACK_SENSOR_ID);
    for (char *c = hostname; *c; c++) {
        *c = (char)tolower((unsigned char)*c);
    }
    esp_netif_set_hostname(netif, hostname);

    wifi_init_config_t init_config = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&init_config));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, on_event, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, on_event, NULL, NULL));

    const esp_timer_create_args_t timer_args = {
        .callback = reconnect,
        .name = "wifi_retry",
    };
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &s_retry_timer));

    wifi_config_t config = { 0 };
    strlcpy((char *)config.sta.ssid, CONFIG_MEDTRACK_WIFI_SSID, sizeof(config.sta.ssid));
    strlcpy((char *)config.sta.password, CONFIG_MEDTRACK_WIFI_PASSWORD, sizeof(config.sta.password));

    /* Offene Netze nur zulassen, wenn kein Passwort eingetragen ist */
    config.sta.threshold.authmode = strlen(CONFIG_MEDTRACK_WIFI_PASSWORD) > 0 ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN;
    config.sta.sae_pwe_h2e = WPA3_SAE_PWE_BOTH;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "Verbinde mit WLAN \"%s\" ...", CONFIG_MEDTRACK_WIFI_SSID);
}

bool wifi_is_connected(void)
{
    return (xEventGroupGetBits(s_events) & CONNECTED_BIT) != 0;
}
