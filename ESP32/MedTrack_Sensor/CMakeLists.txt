# MedTrack Sensor – Firmware für die fest montierten ESP32 (Sensor A, B und C)
#
# Bauen und flashen in der "ESP-IDF 6.1 PowerShell":
#   idf.py set-target esp32
#   idf.py menuconfig        -> "MedTrack Sensor" ausfüllen
#   idf.py -p COM5 flash monitor
cmake_minimum_required(VERSION 3.22)

set(PROJECT_VER "1.0.0")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
# Nur die Komponenten bauen, die main wirklich braucht (deutlich schneller)
idf_build_set_property(MINIMAL_BUILD ON)
project(MedTrack_Sensor)
