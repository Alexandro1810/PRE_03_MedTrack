/* =====================================================
   MEDTRACK
   LOGIN + FRONTEND
===================================================== */


/* =====================================================
   BENUTZER
===================================================== */

const LOGIN_USERNAME = "admin";
const LOGIN_PASSWORD = "medtrack";

const LOGIN_USERNAME2 = "Alex";
const LOGIN_PASSWORD2 = "Wöhrer";

const LOGIN_USERNAME3 = "Julian";
const LOGIN_PASSWORD3 = "Tschiltsch";

const LOGIN_USERNAME4 = "Leon";
const LOGIN_PASSWORD4 = "Parzer";



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
   AKTUELLES GERÄT
===================================================== */

let selectedDevice = 0;


/* =====================================================
   LOGIN
===================================================== */

function login(event) {

    event.preventDefault();


    const username =
        document.getElementById("username").value.trim();


    const password =
        document.getElementById("password").value;


    const error =
        document.getElementById("loginError");


    /*
        Login überprüfen
    */

    if (
        username === LOGIN_USERNAME &&
        password === LOGIN_PASSWORD
    ) {

        /*
            Login speichern
        */

        sessionStorage.setItem(
            "medtrackLoggedIn",
            "true"
        );


        /*
            Login-Fehler löschen
        */

        error.innerText = "";


        /*
            Login verstecken
        */

        document
            .getElementById("loginScreen")
            .classList
            .add("hidden");


        /*
            App anzeigen
        */

        document
            .getElementById("app")
            .classList
            .remove("hidden");


        /*
            Gerät laden
        */

        selectDevice(0);

    }

    else {

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


    /*
        App verstecken
    */

    document
        .getElementById("app")
        .classList
        .add("hidden");


    /*
        Login anzeigen
    */

    document
        .getElementById("loginScreen")
        .classList
        .remove("hidden");


    /*
        Eingaben löschen
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
        Geräteliste markieren
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
        Position
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
        Entfernung
    */

    document.getElementById("distanceA").innerText =
        device.distanceA.toFixed(1) + " m";


    document.getElementById("distanceB").innerText =
        device.distanceB.toFixed(1) + " m";


    /*
        Radius
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


    if (!element || !room) {
        return;
    }


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
        Radius setzen
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
   START
===================================================== */

window.addEventListener(
    "load",
    function () {

        /*
            Überprüfen, ob bereits
            eingeloggt wurde
        */

        const loggedIn =
            sessionStorage.getItem(
                "medtrackLoggedIn"
            );


        if (loggedIn === "true") {

            /*
                Login überspringen
            */

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

        else {

            /*
                Login anzeigen
            */

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