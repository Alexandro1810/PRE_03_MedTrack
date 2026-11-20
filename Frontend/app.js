"use strict";

/* =====================================================
   MEDTRACK – FRONTEND
   Lädt Geräte und Sensoren aus der PHP-API und zeigt
   sie live auf dem Lageplan an.
===================================================== */


/* =====================================================
   KONFIGURATION
===================================================== */

const API_BASE = "api";

const REFRESH_INTERVAL = 3000;    // ms – Geräte und Sensoren
const HISTORY_INTERVAL = 15000;   // ms – Verlauf

const SCALE = 100;                // Lageplan: 1 m = 100 SVG-Einheiten
const SVG_NS = "http://www.w3.org/2000/svg";

const STATUS = {
    "Verfügbar": { tone: "ok", label: "Verfügbar" },
    "Ausgeliehen": { tone: "warn", label: "Ausgeliehen" },
    "Wartung": { tone: "danger", label: "Wartung" }
};

const TYPE_ICONS = [
    [/ekg|kardio/i, "i-ekg"],
    [/infusion|pumpe|perfusor/i, "i-drop"],
    [/defi/i, "i-bolt"],
    [/beatmung|vent/i, "i-lungs"],
    [/ultraschall|sono/i, "i-probe"]
];

const FILTERS = {
    all: () => true,
    available: (device) => device.status === "Verfügbar",
    borrowed: (device) => device.status === "Ausgeliehen",
    nosignal: (device) => !device.online
};


/* =====================================================
   ZUSTAND
===================================================== */

const state = {
    user: null,
    room: null,
    sensors: [],
    devices: [],
    selectedId: null,
    filter: "all",
    search: "",
    fetchedAt: 0,
    serverError: false,
    loading: false,
    timers: [],
    listKey: "",
    mapKey: "",
    locate: { id: null, until: 0 }
};


/* =====================================================
   HILFSFUNKTIONEN
===================================================== */

const $ = (id) => document.getElementById(id);

const meterFormat = new Intl.NumberFormat("de-AT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const timeFormat = new Intl.DateTimeFormat("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
});

const dateTimeFormat = new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
});


class ApiError extends Error {

    constructor(message, status) {
        super(message);
        this.status = status;
    }
}


async function api(path, options = {}) {

    let response;

    try {
        response = await fetch(`${API_BASE}/${path}`, {
            credentials: "same-origin",
            ...options
        });
    } catch {
        throw new ApiError("Server nicht erreichbar. Läuft das Backend (docker compose up)?", 0);
    }

    let data = null;

    try {
        data = await response.json();
    } catch {
        // keine JSON-Antwort, z. B. PHP-Fehlerseite
    }

    // Sitzung abgelaufen, während die App offen war
    if (response.status === 401 && state.user && !path.startsWith("auth/")) {
        showLogin("Sitzung abgelaufen – bitte erneut anmelden.");
    }

    if (!response.ok || !data || data.success === false) {
        throw new ApiError(
            data?.message || `Serverfehler (HTTP ${response.status}).`,
            response.status
        );
    }

    return data;
}


function post(path, params) {

    return api(path, {
        method: "POST",
        body: new URLSearchParams(params)
    });
}


function escapeHtml(value) {

    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };

    return String(value ?? "").replace(/[&<>"']/g, (c) => entities[c]);
}


function formatNumber(value) {

    return value == null ? "–" : meterFormat.format(value);
}


// Sekunden seit der letzten Erkennung – läuft zwischen zwei Abfragen weiter
function secondsAgo(item) {

    if (item.seconds_ago == null) {
        return null;
    }

    return item.seconds_ago + Math.round((Date.now() - state.fetchedAt) / 1000);
}


function timeAgo(seconds, short = false) {

    if (seconds == null) {
        return short ? "nie" : "noch nie";
    }

    if (seconds < 5) {
        return "gerade eben";
    }

    const units = [
        [86400, "Tag", "Tagen", "d"],
        [3600, "Stunde", "Stunden", "h"],
        [60, "Minute", "Minuten", "min"],
        [1, "Sekunde", "Sekunden", "s"]
    ];

    for (const [size, one, many, abbr] of units) {

        if (seconds >= size) {

            const n = Math.floor(seconds / size);

            return short ? `vor ${n} ${abbr}` : `vor ${n} ${n === 1 ? one : many}`;
        }
    }
}


function statusInfo(device) {

    return STATUS[device.status] || { tone: "off", label: device.status || "Unbekannt" };
}


// Farbton eines Geräts: ohne Signal immer grau
function deviceTone(device) {

    return device.online ? statusInfo(device).tone : "off";
}


function typeIcon(type) {

    const match = TYPE_ICONS.find(([pattern]) => pattern.test(type || ""));

    return match ? match[1] : "i-cross";
}


function icon(id) {

    return `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;
}


// 0–4 Signalbalken anhand des stärkeren RSSI-Werts
function signalLevel(device) {

    if (!device.online) {
        return 0;
    }

    const best = Math.max(device.rssi_a ?? -200, device.rssi_b ?? -200, device.rssi_c ?? -200);

    if (best >= -60) return 4;
    if (best >= -70) return 3;
    if (best >= -80) return 2;
    if (best >= -95) return 1;

    return 0;
}


function signalBars(level) {

    return `<span class="bars l${level}" title="Signalstärke ${level} von 4"><i></i><i></i><i></i><i></i></span>`;
}


function selectedDevice() {

    return state.devices.find((device) => device.id === state.selectedId) || null;
}


function sensorById(id) {

    return state.sensors.find((sensor) => sensor.id === id) || null;
}


/* =====================================================
   LOGIN / LOGOUT
===================================================== */

async function login(event) {

    event.preventDefault();

    const button = $("loginButton");
    const error = $("loginError");

    error.textContent = "";
    button.disabled = true;
    button.textContent = "Anmelden …";

    try {

        const data = await post("auth/login.php", {
            username: $("username").value.trim(),
            password: $("password").value
        });

        state.user = data.user;

        $("password").value = "";

        showApp();

    } catch (err) {

        error.textContent = err.status === 401
            ? "Benutzername oder Passwort ist falsch."
            : err.message;

    } finally {

        button.disabled = false;
        button.textContent = "Anmelden";
    }
}


async function logout() {

    try {
        await api("auth/logout.php", { method: "POST" });
    } catch (err) {
        console.error("Logout-Fehler:", err);
    }

    showLogin();
}


async function checkLogin() {

    try {

        const data = await api("auth/me.php");

        state.user = data.user;

        showApp();

    } catch (err) {

        // 401 = einfach nicht eingeloggt, alles andere ist ein Serverproblem
        showLogin(err.status === 401 ? "" : err.message);
    }
}


function showLogin(message = "") {

    stopTimers();

    state.user = null;

    $("app").hidden = true;
    $("loginScreen").hidden = false;
    $("loginError").textContent = message;

    $("username").focus();
}


function showApp() {

    $("loginScreen").hidden = true;
    $("app").hidden = false;

    const { username, role } = state.user;

    $("userName").textContent = username;
    $("userRole").textContent = role;
    $("userAvatar").textContent = username.slice(0, 2).toUpperCase();

    stopTimers();

    refresh();
    loadHistory();

    state.timers = [
        setInterval(refresh, REFRESH_INTERVAL),
        setInterval(loadHistory, HISTORY_INTERVAL),
        setInterval(tick, 1000)
    ];
}


function stopTimers() {

    state.timers.forEach(clearInterval);
    state.timers = [];
}


/* =====================================================
   DATEN LADEN
===================================================== */

async function refresh() {

    if (state.loading) {
        return;
    }

    state.loading = true;

    try {

        const [deviceData, sensorData] = await Promise.all([
            api("devices/get.php"),
            api("sensors/get.php")
        ]);

        state.devices = deviceData.devices;
        state.sensors = sensorData.sensors;
        state.room = sensorData.room;
        state.fetchedAt = Date.now();
        state.serverError = false;

        // erstes Gerät automatisch auswählen
        if (!selectedDevice()) {
            state.selectedId = state.devices[0]?.id ?? null;
        }

        render();

        $("lastUpdate").textContent = timeFormat.format(new Date());

    } catch (err) {

        if (err.status !== 401) {
            console.error("Aktualisierung fehlgeschlagen:", err);
            state.serverError = true;
            renderSystemStatus();
        }

    } finally {

        state.loading = false;
    }
}


async function loadHistory() {

    try {

        const data = await api("devices/history.php");

        renderHistory(data.history);

    } catch (err) {

        if (err.status !== 401) {
            $("historyBody").innerHTML =
                `<tr><td colspan="4" class="empty">Verlauf konnte nicht geladen werden.</td></tr>`;
        }
    }
}


/* =====================================================
   DARSTELLUNG
===================================================== */

function render() {

    if (!state.room) {
        return;
    }

    renderSystemStatus();
    renderKpis();
    renderList();
    renderDetails();
    renderMap();
}


function renderSystemStatus() {

    const pill = $("systemStatus");
    const text = $("systemStatusText");

    const total = state.sensors.length;
    const online = state.sensors.filter((sensor) => sensor.online).length;

    let tone;
    let label;

    if (state.serverError) {
        tone = "danger";
        label = "Server nicht erreichbar";
    } else if (total === 0) {
        tone = "off";
        label = "Keine Sensoren";
    } else if (online === total) {
        tone = "ok";
        label = `${online}/${total} Sensoren online`;
    } else if (online === 0) {
        tone = "danger";
        label = "Sensoren offline";
    } else {
        tone = "warn";
        label = `${online}/${total} Sensoren online`;
    }

    pill.className = `status-pill ${tone}`;
    text.textContent = label;

    pill.title = state.sensors
        .map((s) => `${s.name}: ${s.online ? "online" : "offline"} (zuletzt ${timeAgo(secondsAgo(s))})`)
        .join("\n");

    if (state.room) {
        $("contextText").textContent = `${state.room.station} · ${state.room.name}`;
        $("roomName").textContent = `· ${state.room.name}`;
        $("roomSize").textContent =
            `${formatNumber(state.room.width)} m × ${formatNumber(state.room.height)} m`;
    }
}


function renderKpis() {

    const devices = state.devices;

    $("kpiTotal").textContent = devices.length;
    $("kpiAvailable").textContent = devices.filter(FILTERS.available).length;
    $("kpiBorrowed").textContent = devices.filter(FILTERS.borrowed).length;
    $("kpiNoSignal").textContent = devices.filter(FILTERS.nosignal).length;
}


function matchesSearch(device) {

    const query = state.search.trim().toLowerCase();

    if (!query) {
        return true;
    }

    return [device.name, device.type, device.tag_id]
        .some((value) => (value || "").toLowerCase().includes(query));
}


function renderList() {

    const devices = state.devices
        .filter(FILTERS[state.filter])
        .filter(matchesSearch);

    $("listCount").textContent = `${devices.length} von ${state.devices.length}`;

    // Liste nur neu aufbauen, wenn sich etwas Sichtbares geändert hat
    const key = JSON.stringify([
        state.selectedId,
        devices.map((d) => [d.id, d.name, d.type, d.tag_id, d.status, d.online, signalLevel(d)])
    ]);

    if (key === state.listKey) {
        return;
    }

    state.listKey = key;

    const list = $("deviceList");

    if (devices.length === 0) {
        list.innerHTML = `<li class="empty">Keine Geräte gefunden.</li>`;
        return;
    }

    list.innerHTML = devices.map((device) => {

        const info = statusInfo(device);
        const selected = device.id === state.selectedId;

        return `
            <li>
                <button type="button" class="device-item${selected ? " is-selected" : ""}"
                        data-id="${device.id}" aria-pressed="${selected}">
                    <span class="device-icon tone-${deviceTone(device)}">${icon(typeIcon(device.type))}</span>
                    <span class="device-main">
                        <span class="device-name">${escapeHtml(device.name)}</span>
                        <span class="device-meta">${escapeHtml(device.type)}${device.tag_id ? ` · ${escapeHtml(device.tag_id)}` : ""}</span>
                    </span>
                    <span class="device-side">
                        <span class="badge ${info.tone}">${escapeHtml(info.label)}</span>
                        <span class="seen">
                            ${signalBars(signalLevel(device))}
                            <span data-seen="${device.id}">${timeAgo(secondsAgo(device), true)}</span>
                        </span>
                    </span>
                </button>
            </li>`;

    }).join("");
}


function renderDetails() {

    const device = selectedDevice();

    $("detailEmpty").hidden = Boolean(device);
    $("detailBody").hidden = !device;

    if (!device) {
        return;
    }

    const info = statusInfo(device);
    const located = device.x != null && device.y != null;

    $("dIcon").className = `device-icon device-icon-lg tone-${deviceTone(device)}`;
    $("dIcon").innerHTML = icon(typeIcon(device.type));

    $("dName").textContent = device.name;
    $("dType").textContent = device.type + (device.tag_id ? ` · Tag ${device.tag_id}` : "");

    $("dBadge").className = `badge ${info.tone}`;
    $("dBadge").textContent = info.label;

    $("dLocation").textContent = located
        ? `${state.room.station} · ${state.room.name}`
        : "Noch nicht geortet";

    $("dPosition").textContent = located
        ? `x ${formatNumber(device.x)} m · y ${formatNumber(device.y)} m`
        : "–";

    $("dSeen").textContent = timeAgo(secondsAgo(device));
    $("dSeen").classList.toggle("is-stale", !device.online);

    $("dAvailable").textContent = device.status === "Verfügbar" ? "Ja" : "Nein";

    $("dBorrowedRow").hidden = device.status !== "Ausgeliehen";

    if (device.status === "Ausgeliehen") {

        const since = device.borrowed_at
            ? ` · seit ${dateTimeFormat.format(new Date(device.borrowed_at * 1000))}`
            : "";

        $("dBorrowed").textContent = (device.borrowed_by || "unbekannt") + since;
    }


    // Signalmonitor
    $("vitals").classList.toggle("is-stale", !device.online);
    $("vitalsState").textContent = device.online ? "LIVE" : "KEIN SIGNAL";

    $("vRssiA").textContent = device.rssi_a == null ? "––" : Math.round(device.rssi_a);
    $("vRssiB").textContent = device.rssi_b == null ? "––" : Math.round(device.rssi_b);
    $("vRssiC").textContent = device.rssi_c == null ? "––" : Math.round(device.rssi_c);
    $("vDistA").textContent = device.distance_a == null ? "––" : formatNumber(device.distance_a);
    $("vDistB").textContent = device.distance_b == null ? "––" : formatNumber(device.distance_b);
    $("vDistC").textContent = device.distance_c == null ? "––" : formatNumber(device.distance_c);


    // Ausleihen / Zurückgeben
    const button = $("borrowButton");

    button.disabled = device.status === "Wartung";
    button.classList.toggle("is-return", device.status === "Ausgeliehen");

    $("borrowLabel").textContent = {
        "Ausgeliehen": "Zurückgeben",
        "Wartung": "In Wartung"
    }[device.status] || "Ausleihen";

    $("locateButton").disabled = !located;
}


/* =====================================================
   LAGEPLAN
===================================================== */

// Raum-Koordinaten (Meter, y nach oben) -> SVG-Koordinaten (y nach unten)
function toSvg(x, y) {

    return [x * SCALE, (state.room.height - y) * SCALE];
}


function buildMap() {

    const { width, height } = state.room;
    const key = `${width}x${height}`;

    if (key === state.mapKey) {
        return;
    }

    state.mapKey = key;

    const W = width * SCALE;
    const H = height * SCALE;

    let grid = "";

    for (let x = SCALE; x < W; x += SCALE) {
        grid += `<line class="fp-grid" x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
    }

    for (let y = SCALE; y < H; y += SCALE) {
        grid += `<line class="fp-grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
    }

    let ticks = "";

    for (let m = 0; m <= width; m += 2) {
        ticks += `<text class="fp-tick" x="${m * SCALE}" y="${H + 70}" text-anchor="middle">${m}</text>`;
    }

    for (let m = 0; m <= height; m += 2) {
        ticks += `<text class="fp-tick" x="-52" y="${H - m * SCALE}" text-anchor="end" dominant-baseline="central">${m}</text>`;
    }

    const svg = $("floorplan");

    svg.setAttribute("viewBox", `-140 -70 ${W + 210} ${H + 190}`);

    svg.innerHTML = `
        <defs>
            <clipPath id="roomClip"><rect width="${W}" height="${H}"/></clipPath>
        </defs>
        <rect class="fp-floor" width="${W}" height="${H}"/>
        <g>${grid}</g>
        <g clip-path="url(#roomClip)">
            <circle id="rangeA" class="fp-range a is-hidden" r="0"/>
            <circle id="rangeB" class="fp-range b is-hidden" r="0"/>
            <circle id="rangeC" class="fp-range c is-hidden" r="0"/>
        </g>
        <rect class="fp-wall" width="${W}" height="${H}"/>
        ${ticks}
        <text class="fp-axis" x="${W}" y="${H + 112}" text-anchor="end">x [m]</text>
        <text class="fp-axis" x="-52" y="-30" text-anchor="end">y [m]</text>
        <g id="fpSensors"></g>
        <g id="fpDevices"></g>`;
}


function renderMap() {

    buildMap();
    renderSensors();
    renderRanges();
    renderMarkers();
}


function renderSensors() {

    const { width, height } = state.room;

    $("fpSensors").innerHTML = state.sensors.map((sensor) => {

        const [x, y] = toSvg(sensor.x, sensor.y);

        // Beschriftung Richtung Raummitte, damit sie im Raum liegt
        const right = sensor.x <= width / 2;
        const up = sensor.y <= height / 2;

        const classes = [
            "fp-sensor",
            sensor.id === "B" ? "b" : sensor.id === "C" ? "c" : "",
            sensor.online ? "" : "is-offline"
        ].join(" ");

        return `
            <g class="${classes}" transform="translate(${x} ${y})">
                <title>${escapeHtml(sensor.name)} – ${sensor.online ? "online" : "offline"}</title>
                <circle class="fp-sensor-wave" r="70"/>
                <rect x="-32" y="-32" width="64" height="64" rx="14"/>
                <text class="fp-sensor-id">${escapeHtml(sensor.id)}</text>
                <text class="fp-sensor-label"
                      x="${right ? 52 : -52}" y="${up ? -52 : 70}"
                      text-anchor="${right ? "start" : "end"}">${escapeHtml(sensor.name)}${sensor.online ? "" : " (offline)"}</text>
            </g>`;

    }).join("");
}


// Messradien von Sensor A, B und C um das ausgewählte Gerät
function renderRanges() {

    const device = selectedDevice();

    for (const [circleId, sensorId, key] of [
        ["rangeA", "A", "distance_a"],
        ["rangeB", "B", "distance_b"],
        ["rangeC", "C", "distance_c"]
    ]) {

        const circle = $(circleId);
        const sensor = sensorById(sensorId);
        const distance = device && device.online ? device[key] : null;

        if (distance == null || !sensor) {
            circle.classList.add("is-hidden");
            continue;
        }

        const [cx, cy] = toSvg(sensor.x, sensor.y);

        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("r", distance * SCALE);
        circle.classList.remove("is-hidden");
    }
}


function renderMarkers() {

    const layer = $("fpDevices");

    const existing = new Map(
        [...layer.children].map((marker) => [Number(marker.dataset.id), marker])
    );

    for (const device of state.devices) {

        if (device.x == null || device.y == null) {
            continue;
        }

        let marker = existing.get(device.id);

        if (marker) {

            existing.delete(device.id);

        } else {

            // Marker einmal anlegen und danach nur verschieben -> sanfte Animation
            marker = document.createElementNS(SVG_NS, "g");
            marker.dataset.id = device.id;
            marker.setAttribute("tabindex", "0");
            marker.setAttribute("role", "button");
            marker.innerHTML = `
                <circle class="ring" r="30"/>
                <circle class="dot" r="30"/>
                <use class="glyph" x="-15" y="-15" width="30" height="30"/>
                <text class="marker-label" y="70"></text>`;

            layer.appendChild(marker);
        }

        const [x, y] = toSvg(device.x, device.y);

        const classes = ["marker", `tone-${statusInfo(device).tone}`];

        if (!device.online) classes.push("is-offline");
        if (device.id === state.selectedId) classes.push("is-selected");
        if (device.id === state.locate.id && Date.now() < state.locate.until) classes.push("is-locating");

        marker.setAttribute("class", classes.join(" "));
        marker.setAttribute("aria-label", `${device.name}, ${statusInfo(device).label}`);
        marker.style.transform = `translate(${x}px, ${y}px)`;

        marker.querySelector(".glyph").setAttribute("href", `#${typeIcon(device.type)}`);

        // Beschriftung über den Marker, wenn knapp darunter ein anderes Gerät steht
        const deviceBelow = state.devices.some((other) =>
            other !== device && other.x != null && other.y != null &&
            Math.abs(other.x - device.x) < 1.5 &&
            device.y - other.y > 0 && device.y - other.y < 1.0
        );

        const label = marker.querySelector(".marker-label");

        label.textContent = device.name;
        label.setAttribute("y", deviceBelow ? -46 : 70);
    }

    existing.forEach((marker) => marker.remove());

    // ausgewähltes Gerät zuletzt zeichnen, damit es oben liegt
    const selected = layer.querySelector(".is-selected");

    if (selected && selected !== layer.lastElementChild) {
        layer.appendChild(selected);
    }
}


function renderHistory(entries) {

    const body = $("historyBody");

    if (entries.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="empty">Noch keine Aktivitäten.</td></tr>`;
        return;
    }

    const tones = { "Ausgeliehen": "warn", "Zurückgegeben": "ok" };

    body.innerHTML = entries.map((entry) => `
        <tr>
            <td class="mono">${dateTimeFormat.format(new Date(entry.created_at * 1000))}</td>
            <td>${escapeHtml(entry.device_name)}</td>
            <td><span class="badge ${tones[entry.action] || "off"}">${escapeHtml(entry.action)}</span></td>
            <td>${escapeHtml(entry.username || "–")}</td>
        </tr>`
    ).join("");
}


// läuft jede Sekunde: "vor X Sekunden" weiterzählen
function tick() {

    document.querySelectorAll("[data-seen]").forEach((element) => {

        const device = state.devices.find((d) => d.id === Number(element.dataset.seen));

        if (device) {
            element.textContent = timeAgo(secondsAgo(device), true);
        }
    });

    const device = selectedDevice();

    if (device) {
        $("dSeen").textContent = timeAgo(secondsAgo(device));
    }
}


/* =====================================================
   AKTIONEN
===================================================== */

function selectDevice(id) {

    if (id === state.selectedId) {
        return;
    }

    state.selectedId = id;

    showActionMessage("");

    render();
}


async function toggleBorrow() {

    const device = selectedDevice();

    if (!device) {
        return;
    }

    const action = device.status === "Ausgeliehen" ? "return" : "borrow";
    const button = $("borrowButton");

    button.disabled = true;

    try {

        const result = await post(`devices/${action}.php`, { device_id: device.id });

        showActionMessage(result.message, "ok");

        await refresh();

        loadHistory();

    } catch (err) {

        showActionMessage(err.message, "error");

    } finally {

        button.disabled = selectedDevice()?.status === "Wartung";
    }
}


function locateSelected() {

    const device = selectedDevice();

    if (!device || device.x == null) {
        return;
    }

    state.locate = { id: device.id, until: Date.now() + 2700 };

    renderMarkers();

    $("mapCard").scrollIntoView({ behavior: "smooth", block: "nearest" });

    setTimeout(renderMarkers, 2800);
}


function showActionMessage(message, tone = "") {

    const element = $("actionMessage");

    element.textContent = message;
    element.className = `action-message ${tone}`;
}


/* =====================================================
   EREIGNISSE
===================================================== */

$("loginForm").addEventListener("submit", login);

$("logoutButton").addEventListener("click", logout);

$("borrowButton").addEventListener("click", toggleBorrow);

$("locateButton").addEventListener("click", locateSelected);


$("deviceList").addEventListener("click", (event) => {

    const item = event.target.closest(".device-item");

    if (item) {
        selectDevice(Number(item.dataset.id));
    }
});


$("floorplan").addEventListener("click", (event) => {

    const marker = event.target.closest(".marker");

    if (marker) {
        selectDevice(Number(marker.dataset.id));
    }
});


$("floorplan").addEventListener("keydown", (event) => {

    const marker = event.target.closest(".marker");

    if (marker && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        selectDevice(Number(marker.dataset.id));
    }
});


$("search").addEventListener("input", (event) => {

    state.search = event.target.value;
    state.listKey = "";

    renderList();
});


document.querySelectorAll(".chip").forEach((chip) => {

    chip.addEventListener("click", () => {

        state.filter = chip.dataset.filter;
        state.listKey = "";

        document.querySelectorAll(".chip").forEach((c) => {
            c.setAttribute("aria-pressed", String(c === chip));
        });

        renderList();
    });
});


/* =====================================================
   START
===================================================== */

checkLogin();
