/* =====================================================
   MEDTRACK
   Frontend JavaScript
   Aktuell: Testdaten
   Später: Daten aus PHP API
===================================================== */


/* =====================================================
   TESTDATEN
===================================================== */

const devices = [

    {
        id: 1,
        name: "EKG #01",
        type: "EKG-Gerät",

        x: 7.32,
        y: 5.28,

        rssiA: -58,
        rssiB: -69,

        distanceA: 4.1,
        distanceB: 6.3,

        status: "Online"
    },

    {
        id: 2,
        name: "Pumpe #02",
        type: "Infusionspumpe",

        x: 9.36,
        y: 7.70,

        rssiA: -71,
        rssiB: -52,

        distanceA: 7.4,
        distanceB: 3.8,

        status: "Online"
    }

];


/* =====================================================
   AKTUELL AUSGEWÄHLTES GERÄT
===================================================== */

let selectedDevice = 0;


/* =====================================================
   GERÄT AUSWÄHLEN
===================================================== */

function selectDevice(index) {

    selectedDevice = index;

    const device = devices[index];


    /*
        Geräte im Raum markieren
    */

    document
        .getElementById("device1")
        .classList
        .toggle(
            "selected",
            index === 0
        );

    document
        .getElementById("device2")
        .classList
        .toggle(
            "selected",
            index === 1
        );


    /*
        Geräte-Liste markieren
    */

    document
        .getElementById("item0")
        .classList
        .toggle(
            "selected",
            index === 0
        );

    document
        .getElementById("item1")
        .classList
        .toggle(
            "selected",
            index === 1
        );


    /*
        Positionsdaten
    */

    document.getElementById("x").innerText =
        device.x.toFixed(2) + " m";

    document.getElementById("y").innerText =
        device.y.toFixed(2) + " m";


    /*
        RSSI
    */

    document.getElementById("rssiA").innerText =
        device.rssiA + " dBm";

    document.getElementById("rssiB").innerText =
        device.rssiB + " dBm";


    /*
        Entfernungen
    */

    document.getElementById("distanceA").innerText =
        device.distanceA.toFixed(1) + " m";

    document.getElementById("distanceB").innerText =
        device.distanceB.toFixed(1) + " m";


    /*
        Radius aktualisieren
    */

    updateRadius(index);
}


/* =====================================================
   ORTUNGSRADIUS POSITIONIEREN
===================================================== */

function updateRadius(index) {

    const element =
        document.getElementById(
            "device" + (index + 1)
        );

    const room =
        document.querySelector(".room");


    const roomRect =
        room.getBoundingClientRect();

    const elementRect =
        element.getBoundingClientRect();


    /*
        Mittelpunkt des Geräts
    */

    const x =
        elementRect.left -
        roomRect.left +
        elementRect.width / 2;

    const y =
        elementRect.top -
        roomRect.top +
        elementRect.height / 2;


    /*
        Radius anzeigen
    */

    const radius =
        document.getElementById("radius");

    radius.style.left =
        x + "px";

    radius.style.top =
        y + "px";
}


/* =====================================================
   GERÄT LOKALISIEREN
===================================================== */

function locateDevice() {

    const device =
        devices[selectedDevice];


    alert(
        device.name +
        "\n\n" +

        "Berechnete Position:" +

        "\nX: " +
        device.x.toFixed(2) +
        " m" +

        "\nY: " +
        device.y.toFixed(2) +
        " m" +

        "\n\nRSSI Sensor A: " +
        device.rssiA +
        " dBm" +

        "\nRSSI Sensor B: " +
        device.rssiB +
        " dBm" +

        "\n\nEntfernung A: " +
        device.distanceA.toFixed(1) +
        " m" +

        "\nEntfernung B: " +
        device.distanceB.toFixed(1) +
        " m"
    );
}


/* =====================================================
   INITIALISIERUNG
===================================================== */

window.addEventListener(
    "load",
    function () {

        selectDevice(0);

    }
);


/* =====================================================
   FENSTERGRÖSSE
===================================================== */

window.addEventListener(
    "resize",
    function () {

        updateRadius(selectedDevice);

    }
);