// =========================================================================
// Servicio RPC: ÚNICO archivo que habla con el servidor ZeroC Ice.
// Los componentes nunca usan Ice directamente; llaman a estas funciones.
// Si mañana cambiara la forma de conectarse, solo se toca este archivo.
// =========================================================================

// 1. Librería oficial de ZeroC Ice para JavaScript (instalada con npm).
import { Ice } from "ice";

// 2. Código generado por slice2js a partir de BookingService.ice
//    (el MISMO contrato que usa el servidor Java). En el navegador este
//    archivo registra el módulo "BookingApp" en el objeto global window.
import "../generated/BookingService.js";

const BookingApp = window.BookingApp;

// Puerto WebSocket del servidor (TCP 10000 + 2 = 10002, ver BookingServerApp.java)
const WS_PORT = 10002;

// ¿A qué máquina nos conectamos?
//  - Por defecto, a la misma que sirvió la página (localhost en tu PC, o la IP
//    de la VM si la página se abre como http://IP-DE-LA-VM:3000).
//  - Se puede forzar con la URL:  http://localhost:3000/?host=192.168.1.20
const urlParams = new URLSearchParams(window.location.search);
const SERVER_HOST = urlParams.get("host") || window.location.hostname || "localhost";

let communicator = null; // "motor" de Ice: maneja conexiones e hilos
let proxy = null;        // representante local del objeto remoto BookingService

// Exportamos los enums de Slice para que los componentes puedan compararlos
export const SeatState = BookingApp.SeatState;

export function getServerAddress() {
    return "ws://" + SERVER_HOST + ":" + WS_PORT;
}

// -------------------------------------------------------------------------
// Conexión
// -------------------------------------------------------------------------
export async function connect() {
    if (communicator === null) {
        const initData = new Ice.InitializationData();
        initData.properties = Ice.createProperties();
        // Si el servidor no responde en 5 s, la llamada falla (en vez de quedarse colgada)
        initData.properties.setProperty("Ice.Default.InvocationTimeout", "5000");
        communicator = Ice.initialize(initData);
    }

    // "Identidad:protocolo -h host -p puerto"
    const proxyString = "BookingService:ws -h " + SERVER_HOST + " -p " + WS_PORT;
    const base = communicator.stringToProxy(proxyString);

    // checkedCast pregunta al servidor si ese objeto realmente es un BookingService
    proxy = await BookingApp.BookingServicePrx.checkedCast(base);
    if (proxy === null) {
        throw new Error("El objeto remoto no es un BookingService.");
    }
}

export function isConnected() {
    return proxy !== null;
}

// Si se pierde la conexión, olvidamos el proxy para volver a conectar luego
export function markDisconnected() {
    proxy = null;
}

// -------------------------------------------------------------------------
// Operaciones remotas (cada una es una llamada RPC por WebSocket).
// Todas devuelven una Promesa, por eso se usan con "await".
// -------------------------------------------------------------------------
export function getEventInfo() {
    return proxy.getEventInfo();
}

export function getAllSeats() {
    return proxy.getAllSeats();
}

export function lockSeat(seatId, clientId) {
    return proxy.lockSeat(seatId, clientId);
}

export function releaseSeat(seatId, clientId) {
    return proxy.releaseSeat(seatId, clientId);
}

export function confirmBooking(seatIds, clientId, customerName, customerEmail) {
    return proxy.confirmBooking(seatIds, clientId, customerName, customerEmail);
}

export function getMyLockedSeats(clientId) {
    return proxy.getMyLockedSeats(clientId);
}

export function getMyBookings(clientId) {
    return proxy.getMyBookings(clientId);
}

// -------------------------------------------------------------------------
// Manejo de errores remotos (RF-7)
// Convierte cualquier excepción en un mensaje entendible para el usuario.
// -------------------------------------------------------------------------
export function isConnectionError(error) {
    // Ice.LocalException = problemas de red/conexión (servidor apagado, timeout...)
    return error instanceof Ice.LocalException;
}

export function getErrorMessage(error) {
    // Excepciones declaradas en el .ice (todas heredan de BookingException)
    if (error instanceof BookingApp.SeatNotFoundException) {
        return "La silla no existe: " + error.reason;
    }
    if (error instanceof BookingApp.SeatNotAvailableException) {
        return "Silla no disponible: " + error.reason;
    }
    if (error instanceof BookingApp.LockExpiredException) {
        return "Bloqueo expirado: " + error.reason;
    }
    if (error instanceof BookingApp.InvalidBookingException) {
        return "Datos inválidos: " + error.reason;
    }
    if (error instanceof BookingApp.BookingException) {
        return error.reason;
    }
    // Errores de comunicación
    if (isConnectionError(error)) {
        return "Sin conexión con el servidor (" + getServerAddress() + ").";
    }
    return "Error inesperado: " + (error.message || error);
}
