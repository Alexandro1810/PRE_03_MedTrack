#include <ctype.h>
#include <stdio.h>
#include <string.h>

#include "esp_log.h"
#include "esp_timer.h"

#include "host/ble_hs.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"

#include "ble_scanner.h"
#include "tag_table.h"

/* Scan-Parameter in Einheiten von 0,625 ms: alle 100 ms für 50 ms scannen.
 * WLAN und Bluetooth teilen sich beim ESP32 eine Antenne – die Pausen
 * braucht das WLAN, um die Messwerte verschicken zu können. */
#define SCAN_INTERVAL 160
#define SCAN_WINDOW   80

#ifdef CONFIG_MEDTRACK_ACTIVE_SCAN
#define PASSIVE_SCAN 0
#else
#define PASSIVE_SCAN 1
#endif

#define MAX_ALLOWED_MACS 16
#define RSSI_UNAVAILABLE 127

static const char *TAG = "ble";

static uint8_t s_allowed_macs[MAX_ALLOWED_MACS][6];
static int s_allowed_count;

static void start_scan(void);

#ifdef CONFIG_MEDTRACK_BEACON_SEARCH
/* Beacon-Suche: BLE-Geräte in der Nähe sammeln und alle 5 s ausgeben,
 * damit man die MAC-Adresse eines gekauften Beacons herausfinden kann. */
#define SEARCH_MAX_DEVICES 8
#define SEARCH_LOG_MS      5000

typedef struct {
    uint8_t addr[6];
    int8_t rssi;
    const char *kind;
    char name[TAG_NAME_MAX_LEN];
} nearby_t;

static nearby_t s_nearby[SEARCH_MAX_DEVICES];
static int s_nearby_count;
static int64_t s_last_search_log_ms;

static const char *beacon_kind(const struct ble_hs_adv_fields *fields)
{
    if (fields == NULL) {
        return "BLE";
    }

    /* iBeacon: Apple-Herstellerdaten 4C 00, danach Typ 02 15 */
    if (fields->mfg_data_len >= 4 && fields->mfg_data[0] == 0x4C && fields->mfg_data[1] == 0x00 &&
        fields->mfg_data[2] == 0x02 && fields->mfg_data[3] == 0x15) {
        return "iBeacon";
    }

    /* Eddystone: Service-UUID 0xFEAA */
    for (uint8_t i = 0; i < fields->num_uuids16; i++) {
        if (fields->uuids16[i].value == 0xFEAA) {
            return "Eddystone";
        }
    }
    if (fields->svc_data_uuid16_len >= 2 &&
        fields->svc_data_uuid16[0] == 0xAA && fields->svc_data_uuid16[1] == 0xFE) {
        return "Eddystone";
    }

    return "BLE";
}

static void search_record(const uint8_t addr[6], int8_t rssi, const struct ble_hs_adv_fields *fields)
{
    if (rssi >= CONFIG_MEDTRACK_BEACON_SEARCH_MIN_RSSI) {
        nearby_t *entry = NULL;

        for (int i = 0; i < s_nearby_count; i++) {
            if (memcmp(s_nearby[i].addr, addr, 6) == 0) {
                entry = &s_nearby[i];
                break;
            }
        }

        if (entry == NULL && s_nearby_count < SEARCH_MAX_DEVICES) {
            entry = &s_nearby[s_nearby_count++];
            memset(entry, 0, sizeof(*entry));
            memcpy(entry->addr, addr, 6);
            entry->rssi = rssi;
            entry->kind = "BLE";
        }

        if (entry != NULL) {
            entry->rssi = rssi > entry->rssi ? rssi : entry->rssi;

            const char *kind = beacon_kind(fields);
            if (strcmp(kind, "BLE") != 0) {
                entry->kind = kind;
            }

            if (fields != NULL && fields->name != NULL && entry->name[0] == '\0') {
                size_t n = 0;
                for (uint8_t i = 0; i < fields->name_len && n < sizeof(entry->name) - 1; i++) {
                    char c = (char)fields->name[i];
                    entry->name[n++] = isprint((unsigned char)c) ? c : '?';
                }
                entry->name[n] = '\0';
            }
        }
    }

    int64_t now = esp_timer_get_time() / 1000;
    if (now - s_last_search_log_ms < SEARCH_LOG_MS) {
        return;
    }
    s_last_search_log_ms = now;

    if (s_nearby_count == 0) {
        ESP_LOGI(TAG, "Beacon-Suche: kein BLE-Geraet staerker als %d dBm - Beacon direkt neben den ESP32 legen",
                 CONFIG_MEDTRACK_BEACON_SEARCH_MIN_RSSI);
        return;
    }

    ESP_LOGI(TAG, "Beacon-Suche: %d Geraet(e) in der Naehe (staerkstes Signal = naechstes Geraet):", s_nearby_count);
    for (int i = 0; i < s_nearby_count; i++) {
        const uint8_t *a = s_nearby[i].addr;
        /* NimBLE speichert die Adresse in umgekehrter Reihenfolge */
        ESP_LOGI(TAG, "  %02X:%02X:%02X:%02X:%02X:%02X  RSSI %4d dBm  %-9s %s",
                 a[5], a[4], a[3], a[2], a[1], a[0], s_nearby[i].rssi,
                 s_nearby[i].kind, s_nearby[i].name);
    }
    s_nearby_count = 0;
}
#endif

/* MAC-Liste aus menuconfig einlesen: "AA:BB:CC:DD:EE:FF, 11:22:33:44:55:66" */
static void parse_mac_list(const char *list)
{
    const char *p = list;

    while (*p != '\0' && s_allowed_count < MAX_ALLOWED_MACS) {
        unsigned int b[6];

        if (sscanf(p, " %2x:%2x:%2x:%2x:%2x:%2x", &b[0], &b[1], &b[2], &b[3], &b[4], &b[5]) == 6) {
            /* NimBLE speichert Adressen in umgekehrter Byte-Reihenfolge */
            for (int i = 0; i < 6; i++) {
                s_allowed_macs[s_allowed_count][i] = (uint8_t)b[5 - i];
            }
            s_allowed_count++;
        } else {
            ESP_LOGW(TAG, "Ungueltige MAC-Adresse in der Liste: %s", p);
        }

        p = strchr(p, ',');
        if (p == NULL) {
            break;
        }
        p++;
    }
}

static bool is_allowed_mac(const uint8_t addr[6])
{
    for (int i = 0; i < s_allowed_count; i++) {
        if (memcmp(s_allowed_macs[i], addr, 6) == 0) {
            return true;
        }
    }
    return false;
}

static bool has_tag_prefix(const uint8_t *name, uint8_t length)
{
    size_t prefix_len = strlen(CONFIG_MEDTRACK_TAG_NAME_PREFIX);

    return prefix_len > 0 && length >= prefix_len &&
           memcmp(name, CONFIG_MEDTRACK_TAG_NAME_PREFIX, prefix_len) == 0;
}

/* Wird für jedes empfangene Advertising-Paket aufgerufen */
static void handle_advertisement(const ble_addr_t *addr, int8_t rssi, const uint8_t *data, uint8_t length)
{
    if (rssi == RSSI_UNAVAILABLE) {
        return;
    }

    char name[TAG_NAME_MAX_LEN] = "";
    struct ble_hs_adv_fields fields;
    bool parsed = ble_hs_adv_parse_fields(&fields, data, length) == 0;

#ifdef CONFIG_MEDTRACK_BEACON_SEARCH
    search_record(addr->val, rssi, parsed ? &fields : NULL);
#endif

    if (parsed && fields.name != NULL && has_tag_prefix(fields.name, fields.name_len)) {

        /* nur unkritische Zeichen übernehmen – der Name landet im JSON */
        size_t n = 0;
        for (uint8_t i = 0; i < fields.name_len && n < sizeof(name) - 1; i++) {
            char c = (char)fields.name[i];
            if (isalnum((unsigned char)c) || c == '-' || c == '_' || c == '.' || c == '#') {
                name[n++] = c;
            }
        }
        name[n] = '\0';
    }

    /* Tag erkannt über den Namen, die MAC-Liste oder weil die Adresse schon
     * bekannt ist (z. B. Scan-Response-Pakete ohne Namen) */
    if (name[0] != '\0' || is_allowed_mac(addr->val) || tag_table_contains(addr->val)) {
        tag_table_add(addr->val, name, rssi);
    }
}

static int on_gap_event(struct ble_gap_event *event, void *arg)
{
    switch (event->type) {
    case BLE_GAP_EVENT_DISC:
        handle_advertisement(&event->disc.addr, event->disc.rssi,
                             event->disc.data, event->disc.length_data);
        return 0;

#if CONFIG_BT_NIMBLE_EXT_ADV
    case BLE_GAP_EVENT_EXT_DISC:
        handle_advertisement(&event->ext_disc.addr, event->ext_disc.rssi,
                             event->ext_disc.data, event->ext_disc.length_data);
        return 0;
#endif

    case BLE_GAP_EVENT_DISC_COMPLETE:
        ESP_LOGW(TAG, "Scan beendet (Grund %d), starte neu", event->disc_complete.reason);
        start_scan();
        return 0;

    default:
        return 0;
    }
}

static void start_scan(void)
{
    uint8_t own_addr_type;

    if (ble_hs_id_infer_auto(0, &own_addr_type) != 0) {
        ESP_LOGE(TAG, "Adresstyp konnte nicht bestimmt werden");
        return;
    }

    struct ble_gap_disc_params params = {
        .itvl = SCAN_INTERVAL,
        .window = SCAN_WINDOW,
        .filter_policy = 0,       /* alle Geräte empfangen */
        .limited = 0,
        .passive = PASSIVE_SCAN,
        .filter_duplicates = 0,   /* jedes Paket liefert einen neuen RSSI-Wert */
    };

    int rc = ble_gap_disc(own_addr_type, BLE_HS_FOREVER, &params, on_gap_event, NULL);
    if (rc != 0) {
        ESP_LOGE(TAG, "Scan konnte nicht gestartet werden (rc=%d)", rc);
    }
}

static void on_sync(void)
{
    int rc = ble_hs_util_ensure_addr(0);
    if (rc != 0) {
        ESP_LOGE(TAG, "Keine BLE-Adresse verfuegbar (rc=%d)", rc);
        return;
    }

    ESP_LOGI(TAG, "Scanne nach Tags mit Namen \"%s...\" und %d MAC-Adresse(n)",
             CONFIG_MEDTRACK_TAG_NAME_PREFIX, s_allowed_count);
    start_scan();
}

static void on_reset(int reason)
{
    ESP_LOGW(TAG, "BLE-Stack zurueckgesetzt (Grund %d)", reason);
}

static void host_task(void *param)
{
    /* läuft, bis nimble_port_stop() aufgerufen wird */
    nimble_port_run();
    nimble_port_freertos_deinit();
}

void ble_scanner_start(void)
{
    parse_mac_list(CONFIG_MEDTRACK_TAG_MACS);

    ESP_ERROR_CHECK(nimble_port_init());

    ble_hs_cfg.sync_cb = on_sync;
    ble_hs_cfg.reset_cb = on_reset;

    nimble_port_freertos_init(host_task);
}
