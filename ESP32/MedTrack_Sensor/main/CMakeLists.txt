idf_component_register(
    SRCS
        "main.c"
        "wifi.c"
        "ble_scanner.c"
        "tag_table.c"
        "reporter.c"
    INCLUDE_DIRS "."
    PRIV_REQUIRES
        nvs_flash
        esp_wifi
        esp_netif
        esp_event
        esp_timer
        esp_http_client
        esp_app_format
        bt
)
