// =========================================================================
// PUNTO DE ENTRADA DE LA APLICACIÓN (Webpack empieza aquí)
//
// index.js es el "director de orquesta":
//   1. Guarda el estado de la app (sillas, info del evento, conexión).
//   2. Llama al servicio RPC (services/bookingService.js).
//   3. Le pasa los datos a cada componente para que se dibuje.
//   4. Recibe los clics de los componentes y decide qué hacer.
// =========================================================================
import "./styles/global.css";

import * as api from "./services/bookingService.js";
import { getClientId } from "./utils/clientId.js";
import { longToNumber } from "./utils/format.js";

import { Header } from "./components/Header.js";
import { SeatMap } from "./components/SeatMap.js";
import { Timer } from "./components/Timer.js";
import { CartPanel } from "./components/CartPanel.js";
import { CheckoutModal } from "./components/CheckoutModal.js";
import { MyBookings } from "./components/MyBookings.js";
import { Toast } from "./components/Toast.js";

const LOCK_DURATION_SECONDS = 90;
const REFRESH_INTERVAL_MS = 2000; // cada 2 s se pide el estado al servidor
const TICK_INTERVAL_MS = 1000;    // cada 1 s se actualiza la cuenta regresiva

const clientId = getClientId();

// -------------------------------------------------------------------------
// Estado de la aplicación (una sola fuente de verdad en el cliente)
// -------------------------------------------------------------------------
const state = {
    connected: false,
    eventInfo: null,
    seats: [],
    bookings: []
};

// Momento (en ms del reloj del navegador) en que vence cada silla que bloqueé.
// Ej: { "A-1": 1732420000000 }
const lockExpirations = {};

// -------------------------------------------------------------------------
// Creación de componentes (cada uno recibe su contenedor del index.html)
// -------------------------------------------------------------------------
const toast = new Toast(document.getElementById("toast-container"));
const header = new Header(document.getElementById("header"));
const seatMap = new SeatMap(document.getElementById("seat-map"), handleSeatClick);
const timer = new Timer(document.getElementById("timer"), LOCK_DURATION_SECONDS);
const cart = new CartPanel(document.getElementById("cart"), {
    onRemoveSeat: handleReleaseSeat,
    onReleaseAll: handleReleaseAll,
    onCheckout: handleOpenCheckout
});
const checkoutModal = new CheckoutModal(document.getElementById("checkout-modal"), handleConfirmBooking);
const myBookings = new MyBookings(document.getElementById("my-bookings"));

// -------------------------------------------------------------------------
// Funciones auxiliares sobre el estado
// -------------------------------------------------------------------------

// Sillas que ESTE cliente tiene bloqueadas en este momento
function getMySeats() {
    return state.seats.filter((seat) =>
        seat.state.name === "LOCKED" && seat.lockedByClientId === clientId
    );
}

// Segundos que le quedan a una silla mía antes de liberarse
function getRemainingSeconds(seat) {
    let expiresAt = lockExpirations[seat.id];
    if (expiresAt === undefined) {
        // Caso: recargué la página y la silla ya estaba bloqueada por mí.
        // Usamos el momento del bloqueo que guardó el servidor.
        expiresAt = longToNumber(seat.lockTimestamp) + longToNumber(seat.lockDurationSeconds) * 1000;
        lockExpirations[seat.id] = expiresAt;
    }
    return Math.ceil((expiresAt - Date.now()) / 1000);
}

// La retención que vence primero (o null si no tengo sillas)
function getMinRemainingSeconds(mySeats) {
    if (mySeats.length === 0) {
        return null;
    }
    let min = Infinity;
    for (const seat of mySeats) {
        min = Math.min(min, getRemainingSeconds(seat));
    }
    return Math.max(0, min);
}

function getTotal(seats) {
    let total = 0;
    for (const seat of seats) {
        total += seat.price;
    }
    return total;
}

// -------------------------------------------------------------------------
// Dibujar todo
// -------------------------------------------------------------------------
function renderAll() {
    const mySeats = getMySeats();
    header.render(state.eventInfo, state.connected, clientId, api.getServerAddress());
    seatMap.render(state.seats, clientId);
    renderTimeParts(mySeats);
    myBookings.render(state.bookings);
}

// Partes que cambian cada segundo (temporizador y tiempos del carrito)
function renderTimeParts(mySeats) {
    const items = mySeats.map((seat) => ({
        seat: seat,
        remainingSeconds: Math.max(0, getRemainingSeconds(seat))
    }));
    cart.render(items);

    const minRemaining = getMinRemainingSeconds(mySeats);
    timer.render(minRemaining);
    if (checkoutModal.isOpen) {
        checkoutModal.updateRemaining(minRemaining);
    }
}

// -------------------------------------------------------------------------
// Comunicación con el servidor
// -------------------------------------------------------------------------

// Pide al servidor el estado actual de las sillas y del evento (RF-1)
async function refresh() {
    try {
        if (!api.isConnected()) {
            await api.connect();
            await loadBookings();
            if (!state.connected) {
                toast.show("Conectado al servidor " + api.getServerAddress(), "success");
            }
        }

        // Dos llamadas RPC en paralelo
        const [seats, eventInfo] = await Promise.all([api.getAllSeats(), api.getEventInfo()]);
        state.seats = seats;
        state.eventInfo = eventInfo;
        state.connected = true;
    } catch (error) {
        handleError(error);
    }
    renderAll();
}

async function loadBookings() {
    state.bookings = await api.getMyBookings(clientId);
}

// Manejo central de errores (RF-7): nunca rompe la app, solo avisa
function handleError(error) {
    if (api.isConnectionError(error)) {
        if (state.connected) {
            toast.show("Se perdió la conexión con el servidor. Reintentando...", "error");
        }
        state.connected = false;
        api.markDisconnected();
    } else {
        toast.show(api.getErrorMessage(error), "error");
    }
    console.error(error);
}

// -------------------------------------------------------------------------
// Acciones del usuario
// -------------------------------------------------------------------------

// Clic en una silla del plano (RF-2 y RF-4)
async function handleSeatClick(seat) {
    if (!state.connected) {
        toast.show("No hay conexión con el servidor.", "error");
        return;
    }

    const status = seat.state.name;
    if (status === "AVAILABLE") {
        try {
            const result = await api.lockSeat(seat.id, clientId);
            lockExpirations[seat.id] = Date.now() + LOCK_DURATION_SECONDS * 1000;
            toast.show(result.message + " (" + seat.id + ")", "success");
        } catch (error) {
            handleError(error);
        }
    } else if (status === "LOCKED" && seat.lockedByClientId === clientId) {
        // Clic sobre una silla mía = quitarla del carrito
        await handleReleaseSeat(seat.id);
        return;
    } else if (status === "LOCKED") {
        toast.show("La silla " + seat.id + " está bloqueada por otro comprador.", "warning");
    } else {
        toast.show("La silla " + seat.id + " ya fue vendida.", "warning");
    }
    await refresh();
}

// Liberar una silla manualmente (RF-4)
async function handleReleaseSeat(seatId) {
    try {
        const released = await api.releaseSeat(seatId, clientId);
        delete lockExpirations[seatId];
        if (released) {
            toast.show("Silla " + seatId + " liberada.", "info");
        } else {
            toast.show("La silla " + seatId + " ya no estaba retenida por ti.", "warning");
        }
    } catch (error) {
        handleError(error);
    }
    await refresh();
}

// Liberar todas mis sillas
async function handleReleaseAll() {
    const mySeats = getMySeats();
    try {
        for (const seat of mySeats) {
            await api.releaseSeat(seat.id, clientId);
            delete lockExpirations[seat.id];
        }
        toast.show("Se liberaron " + mySeats.length + " sillas.", "info");
    } catch (error) {
        handleError(error);
    }
    await refresh();
}

function handleOpenCheckout() {
    const mySeats = getMySeats();
    if (mySeats.length === 0) {
        toast.show("Primero selecciona al menos una silla.", "warning");
        return;
    }
    checkoutModal.open(mySeats, getTotal(mySeats), getMinRemainingSeconds(mySeats));
}

// Confirmar la compra (RF-5). La llama el modal al enviar el formulario.
async function handleConfirmBooking(name, email) {
    const seatIds = getMySeats().map((seat) => seat.id);
    if (seatIds.length === 0) {
        checkoutModal.showError("Ya no tienes sillas retenidas. Vuelve al plano y selecciónalas de nuevo.");
        return;
    }

    try {
        const result = await api.confirmBooking(seatIds, clientId, name, email);
        for (const seatId of seatIds) {
            delete lockExpirations[seatId];
        }
        checkoutModal.showReceipt(result, name, email);
        toast.show("¡Compra confirmada! Código " + result.bookingCode, "success");
        await loadBookings();
    } catch (error) {
        checkoutModal.showError(api.getErrorMessage(error));
        handleError(error);
    }
    await refresh();
}

// -------------------------------------------------------------------------
// Temporizador: se ejecuta cada segundo (RF-3)
// -------------------------------------------------------------------------
async function tick() {
    const mySeats = getMySeats();
    const expiredSeats = mySeats.filter((seat) => getRemainingSeconds(seat) <= 0);

    if (expiredSeats.length > 0) {
        for (const seat of expiredSeats) {
            // Cambiamos el estado local para no procesarla dos veces
            seat.state = api.SeatState.AVAILABLE;
            seat.lockedByClientId = "";
            delete lockExpirations[seat.id];
            toast.show("Se acabó el tiempo: la silla " + seat.id + " fue liberada.", "warning");
            try {
                // El servidor también la libera solo; esto lo hace inmediato
                await api.releaseSeat(seat.id, clientId);
            } catch (error) {
                handleError(error);
            }
        }
        await refresh();
        return;
    }

    renderTimeParts(mySeats);
}

// -------------------------------------------------------------------------
// Arranque
// -------------------------------------------------------------------------
renderAll();
refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
setInterval(tick, TICK_INTERVAL_MS);
