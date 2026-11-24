// =========================================================================
// Componente Header
// Responsabilidad: mostrar la información del evento, los contadores del
// aforo (disponibles / retenidas / vendidas) y el estado de la conexión.
// =========================================================================
import "../styles/header.css";

export class Header {
    constructor(container) {
        this.container = container;
    }

    render(eventInfo, connected, clientId, serverAddress) {
        const name = eventInfo ? eventInfo.name : "Icesi Live Arena";
        const details = eventInfo
            ? eventInfo.date + " · " + eventInfo.venue + " · Aforo total: " + eventInfo.totalSeats + " sillas"
            : "Conectando con el servidor...";

        const available = eventInfo ? eventInfo.availableSeats : "-";
        const locked = eventInfo ? eventInfo.lockedSeats : "-";
        const booked = eventInfo ? eventInfo.bookedSeats : "-";

        const statusText = connected ? "ONLINE" : "OFFLINE";
        const statusClass = connected ? "status--online" : "status--offline";

        this.container.innerHTML = `
            <div class="header">
                <div class="header__info">
                    <h1 class="header__title">Icesi Live Arena — Reserva de Boletas</h1>
                    <p class="header__event">${name}</p>
                    <p class="header__details">${details}</p>
                    <p class="header__session">Tu sesión: <strong>${clientId}</strong> · Servidor: ${serverAddress}</p>
                </div>
                <div class="header__stats">
                    <div class="stat">
                        <span class="stat__label">Disponibles</span>
                        <span class="stat__value">${available}</span>
                    </div>
                    <div class="stat">
                        <span class="stat__label">Retenidas</span>
                        <span class="stat__value">${locked}</span>
                    </div>
                    <div class="stat">
                        <span class="stat__label">Vendidas</span>
                        <span class="stat__value">${booked}</span>
                    </div>
                    <div class="stat">
                        <span class="stat__label">Estado</span>
                        <span class="stat__value status ${statusClass}">${statusText}</span>
                    </div>
                </div>
            </div>
        `;
    }
}
