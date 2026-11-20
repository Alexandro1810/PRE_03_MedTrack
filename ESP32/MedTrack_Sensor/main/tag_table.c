#include <stdio.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "esp_timer.h"

#include "tag_table.h"

/* Ringpuffer je Tag. Bei ca. 5 empfangenen Paketen pro Sekunde
 * reicht das für gut 6 Sekunden. */
#define MAX_SAMPLES 32

typedef struct {
    bool used;
    uint8_t addr[6];
    char name[TAG_NAME_MAX_LEN];
    int8_t rssi[MAX_SAMPLES];
    int64_t time_ms[MAX_SAMPLES];
    uint8_t next;     /* nächste Schreibposition */
    uint8_t count;    /* gültige Werte im Puffer */
    int64_t last_ms;  /* letzter Empfang */
} tag_entry_t;

static tag_entry_t s_tags[TAG_TABLE_MAX_TAGS];
static SemaphoreHandle_t s_lock;

static int64_t now_ms(void)
{
    return esp_timer_get_time() / 1000;
}

static tag_entry_t *find(const uint8_t addr[6])
{
    for (int i = 0; i < TAG_TABLE_MAX_TAGS; i++) {
        if (s_tags[i].used && memcmp(s_tags[i].addr, addr, 6) == 0) {
            return &s_tags[i];
        }
    }
    return NULL;
}

/* Freien Platz nehmen – oder den Tag ersetzen, der am längsten nicht gesehen wurde */
static tag_entry_t *find_or_create(const uint8_t addr[6])
{
    tag_entry_t *entry = find(addr);
    if (entry) {
        return entry;
    }

    entry = &s_tags[0];
    for (int i = 0; i < TAG_TABLE_MAX_TAGS; i++) {
        if (!s_tags[i].used) {
            entry = &s_tags[i];
            break;
        }
        if (s_tags[i].last_ms < entry->last_ms) {
            entry = &s_tags[i];
        }
    }

    memset(entry, 0, sizeof(*entry));
    entry->used = true;
    memcpy(entry->addr, addr, 6);
    return entry;
}

/* Median – robust gegen einzelne Ausreißer durch Reflexionen */
static int median(int8_t *values, int count)
{
    /* Insertion Sort, bei max. 32 Werten völlig ausreichend */
    for (int i = 1; i < count; i++) {
        int8_t v = values[i];
        int j = i - 1;
        while (j >= 0 && values[j] > v) {
            values[j + 1] = values[j];
            j--;
        }
        values[j + 1] = v;
    }

    if (count % 2 == 1) {
        return values[count / 2];
    }
    /* Mittelwert der beiden mittleren Werte, kaufmännisch gerundet (Werte sind negativ) */
    int sum = values[count / 2 - 1] + values[count / 2];
    return (sum - 1) / 2;
}

void tag_table_init(void)
{
    s_lock = xSemaphoreCreateMutex();
}

void tag_table_add(const uint8_t addr[6], const char *name, int8_t rssi)
{
    int64_t now = now_ms();

    xSemaphoreTake(s_lock, portMAX_DELAY);

    tag_entry_t *tag = find_or_create(addr);

    if (name != NULL && name[0] != '\0') {
        strlcpy(tag->name, name, sizeof(tag->name));
    }

    tag->rssi[tag->next] = rssi;
    tag->time_ms[tag->next] = now;
    tag->next = (tag->next + 1) % MAX_SAMPLES;
    if (tag->count < MAX_SAMPLES) {
        tag->count++;
    }
    tag->last_ms = now;

    xSemaphoreGive(s_lock);
}

bool tag_table_contains(const uint8_t addr[6])
{
    xSemaphoreTake(s_lock, portMAX_DELAY);
    bool found = find(addr) != NULL;
    xSemaphoreGive(s_lock);

    return found;
}

size_t tag_table_snapshot(tag_reading_t *out, size_t max, uint32_t window_ms, int min_samples)
{
    int64_t limit = now_ms() - window_ms;
    int8_t values[MAX_SAMPLES];
    size_t n = 0;

    xSemaphoreTake(s_lock, portMAX_DELAY);

    for (int i = 0; i < TAG_TABLE_MAX_TAGS && n < max; i++) {
        tag_entry_t *tag = &s_tags[i];
        if (!tag->used) {
            continue;
        }

        int count = 0;
        for (int k = 0; k < tag->count; k++) {
            if (tag->time_ms[k] >= limit) {
                values[count++] = tag->rssi[k];
            }
        }

        if (count < min_samples) {
            continue;
        }

        tag_reading_t *reading = &out[n++];
        reading->rssi = median(values, count);
        reading->samples = count;
        strlcpy(reading->name, tag->name, sizeof(reading->name));

        /* NimBLE speichert die Adresse in umgekehrter Reihenfolge */
        snprintf(reading->mac, sizeof(reading->mac), "%02x:%02x:%02x:%02x:%02x:%02x",
                 tag->addr[5], tag->addr[4], tag->addr[3],
                 tag->addr[2], tag->addr[1], tag->addr[0]);
    }

    xSemaphoreGive(s_lock);

    return n;
}
