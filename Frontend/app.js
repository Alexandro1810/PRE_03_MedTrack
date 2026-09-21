/* =====================================================
   MEDTRACK
   LOGIN + GERÄTEORTUNG
===================================================== */


/* =====================================================
   BENUTZER
===================================================== */

/*
    HIER kannst du neue Benutzer hinzufügen.

    username = Benutzername
    password = Passwort
*/

const users = [

    {
        username: "admin",
        password: "medtrack"
    },

    {
        username: "Alex",
        password: "Wöhrer"
    },

    {
        username: "Julian",
        password: "Tschiltsch"
    },

    {
        username: "Leon",
        password: "Parzer"
    }

];


/* =====================================================
   TESTDATEN DER GERÄTE
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
   LOGIN
===================================================== */

function login(event) {

    /*
        Verhindert, dass die Seite
        beim Absenden neu geladen wird.
    */

    event.preventDefault();


    /*
        Eingaben auslesen
    */

    const username =
        document
            .getElementById("username")
            .value
            .trim();


    const password =
        document
            .getElementById("password")
            .value;


    const error =
        document.getElementById("loginError");


    /*
        Benutzer suchen
    */

    const user = users.find(function (user) {

        return (
            user.username === username &&
            user.password === password
        );

    });


    /*
        Wenn Benutzer gefunden wurde
    */

    if (user) {

        /*
            Login speichern
        */

        sessionStorage.setItem(
            "medtrackLoggedIn",
            "true"
        );


        /*
            Benutzer speichern
        */

        sessionStorage.setItem(
            "medtrackUser",
            user.username
        );


        /*
            Fehlermeldung entfernen
        */

        error.innerText = "";


        /*
            Login ausblenden
        */

        document
            .getElementById("loginScreen")
            .classList
            .add("hidden");


        /*
            MedTrack anzeigen
        */

        document
            .getElementById("app")
            .classList
            .remove("hidden");


        /*
            Gerät auswählen
        */

        selectDevice(0);

    }

    else {

        /*
            Falsche Daten
        */

        error.innerText =
            "Benutzername oder Passwort ist falsch.";

    }

}


/* =====================================================
   LOGOUT
===================================================== */

function logout() {

    /*
        Login löschen
    */

    sessionStorage.removeItem(
        "medtrackLoggedIn"
    );


    sessionStorage.removeItem(
        "medtrackUser"
    );


    /*
        MedTrack verstecken
    */

    document
        .getElementById("app")
        .classList
        .add("hidden");


    /*
        Login wieder anzeigen
    */

    document
        .getElementById("loginScreen")
        .classList
        .remove("hidden");


    /*
        Eingabefelder leeren
    */

    document.getElementById("username").value = "";

    document.getElementById("password").value = "";

    document.getElementById("loginError").innerText = "";

}


/* =====================================================
   GERÄT AUSWÄHLEN
===================================================== */

function selectDevice(index) {

    selectedDevice = index;


    const device =
        devices[index];


    /*
        Gerät im Raum markieren
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
        Gerät in der Liste markieren
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
        Position anzeigen
    */

    document.getElementById("x").innerText =
        device.x.toFixed(2) + " m";


    document.getElementById("y").innerText =
        device.y.toFixed(2) + " m";


    /*
        RSSI anzeigen
    */

    document.getElementById("rssiA").innerText =
        device.rssiA + " dBm";


    document.getElementById("rssiB").innerText =
        device.rssiB + " dBm";


    /*
        Entfernung anzeigen
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
   RADIUS
===================================================== */

function updateRadius(index) {

    const element =
        document.getElementById(
            "device" + (index + 1)
        );


    const room =
        document.querySelector(".room");


    /*
        Sicherheitsprüfung
    */

    if (!element || !room) {

        return;

    }


    /*
        Größe und Position des Raums
    */

    const roomRect =
        room.getBoundingClientRect();


    /*
        Größe und Position des Geräts
    */

    const elementRect =
        element.getBoundingClientRect();


    /*
        Mittelpunkt des Geräts berechnen
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
        Radius bewegen
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
   START DER ANWENDUNG
===================================================== */

window.addEventListener(
    "load",
    function () {

        /*
            Prüfen, ob bereits
            eingeloggt wurde.
        */

        const loggedIn =
            sessionStorage.getItem(
                "medtrackLoggedIn"
            );


        /*
            Wenn eingeloggt:
            MedTrack direkt anzeigen.
        */

        if (loggedIn === "true") {

            document
                .getElementById("loginScreen")
                .classList
                .add("hidden");


            document
                .getElementById("app")
                .classList
                .remove("hidden");


            selectDevice(0);

        }


        /*
            Wenn NICHT eingeloggt:
            Login anzeigen.
        */

        else {

            document
                .getElementById("loginScreen")
                .classList
                .remove("hidden");


            document
                .getElementById("app")
                .classList
                .add("hidden");

        }

    }
);


/* =====================================================
   LOGIN-FORMULAR
===================================================== */

document
    .getElementById("loginForm")
    .addEventListener(
        "submit",
        login
    );


/* =====================================================
   FENSTERGRÖSSE
===================================================== */

window.addEventListener(
    "resize",
    function () {

        const loggedIn =
            sessionStorage.getItem(
                "medtrackLoggedIn"
            );


        if (loggedIn === "true") {

            updateRadius(selectedDevice);

        }

    }
);