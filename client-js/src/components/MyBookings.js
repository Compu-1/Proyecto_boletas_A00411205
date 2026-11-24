// =========================================================================
// Componente MyBookings (historial de compras del cliente, RF-6)
// Responsabilidad: listar las reservas confirmadas de este clientId.
// =========================================================================
import "../styles/bookings.css";
import { formatPrice, formatDateTime, longToNumber, escapeHtml } from "../utils/format.js";

export class MyBookings {
    constructor(container) {
        this.container = container;
    }

    // bookings = arreglo de BookingRecord que devuelve getMyBookings
    render(bookings) {
        let itemsHtml = "";
        for (const booking of bookings) {
            itemsHtml += `
                <li class="booking">
                    <div class="booking__code">${booking.bookingCode}</div>
                    <div>Sillas: ${booking.seatIds.join(", ")}</div>
                    <div>Total: <strong>${formatPrice(booking.totalAmount)}</strong></div>
                    <div class="muted">${escapeHtml(booking.customerName)} ·${formatDateTime(longToNumber(booking.timestamp))}</div>
                </li>
            `;
        }

        if (bookings.length === 0) {
            itemsHtml = `<li class="muted">Todavía no tienes compras confirmadas.</li>`;
        }

        this.container.innerHTML = `
            <h2 class="card__title">Mis Reservas (${bookings.length})</h2>
            <ul class="bookings__list">${itemsHtml}</ul>
        `;
    }
}
