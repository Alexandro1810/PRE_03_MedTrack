#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define TAG_TABLE_MAX_TAGS 16   /* so viele Tags werden gleichzeitig verfolgt */
#define TAG_NAME_MAX_LEN   24

typedef struct {
    char name[TAG_NAME_MAX_LEN];  /* BLE-Name, z. B. "MT-01" (leer, falls unbekannt) */
    char mac[18];                 /* "aa:bb:cc:dd:ee:ff" */
    int rssi;                     /* Median im Zeitfenster in dBm */
    int samples;                  /* Anzahl Messwerte im Zeitfenster */
} tag_reading_t;

void tag_table_init(void);

/* Neuer Messwert eines Tags (wird vom BLE-Scanner aufgerufen).
 * addr ist die Adresse im NimBLE-Format (umgekehrte Byte-Reihenfolge). */
void tag_table_add(const uint8_t addr[6], const char *name, int8_t rssi);

/* true, wenn diese Adresse bereits als Tag erkannt wurde */
bool tag_table_contains(const uint8_t addr[6]);

/* Füllt out mit dem RSSI-Median jedes Tags aus den letzten window_ms
 * Millisekunden. Tags mit weniger als min_samples Werten werden übersprungen.
 * Rückgabe: Anzahl der Einträge in out. */
size_t tag_table_snapshot(tag_reading_t *out, size_t max, uint32_t window_ms, int min_samples);
