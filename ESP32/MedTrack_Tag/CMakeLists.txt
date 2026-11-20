# MedTrack Tag – macht einen ESP32 zu einem BLE-Tag (Beacon) für Tests,
# solange noch keine gekauften Tags vorhanden sind.
#
#   idf.py set-target esp32
#   idf.py menuconfig        -> "MedTrack Tag" -> Name z. B. "MT-01"
#   idf.py -p COM6 flash monitor
cmake_minimum_required(VERSION 3.22)

set(PROJECT_VER "1.0.0")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
# Nur die Komponenten bauen, die main wirklich braucht (deutlich schneller)
idf_build_set_property(MINIMAL_BUILD ON)
project(MedTrack_Tag)
