// =========================================================================
// Componente SeatMap (plano de sillas)
// Responsabilidad: dibujar las 90 sillas agrupadas por zona y fila, pintar
// cada una según su estado y avisar a index.js cuando se hace clic en una.
// No llama al servidor: solo recibe datos y emite eventos (onSeatClick).
// =========================================================================
import "../styles/seat-map.css";
import { formatPrice, ZONE_NAMES } from "../utils/format.js";

// Orden en que se dibujan las zonas (de la más cercana al escenario a la más lejana)
const ZONE_ORDER = ["ZONEVIP", "ZONEPLATEA", "ZONEGENERAL"];

const STATE_LABELS = {
    available: "Disponible",
    mine: "Seleccionada (tuya)",
    locked: "Bloqueada por otro",
    booked: "Vendida"
};

export class SeatMap {
    constructor(container, onSeatClick) {
        this.container = container;
        this.onSeatClick = onSeatClick; // función que recibe la silla clicada
    }

    // Decide cómo se ve una silla desde el punto de vista de ESTE cliente
    getSeatStatus(seat, clientId) {
        const state = seat.state.name; // "AVAILABLE", "LOCKED" o "BOOKED"
        if (state === "BOOKED") {
            return "booked";
        }
        if (state === "LOCKED") {
            return seat.lockedByClientId === clientId ? "mine" : "locked";
        }
        return "available";
    }

    render(seats, clientId) {
        // Si ninguna silla cambió desde el último dibujo, no se redibuja
        // (evita parpadeos y que se pierda un clic durante el refresco).
        let snapshot = "";
        for (const seat of seats) {
            snapshot += seat.id + seat.state.name + seat.lockedByClientId + "|";
        }
        if (snapshot === this.lastSnapshot) {
            return;
        }
        this.lastSnapshot = snapshot;

        this.container.innerHTML = "";

        const title = document.createElement("h2");
        title.className = "card__title";
        title.textContent = "Distribución de Sillas";
        this.container.appendChild(title);

        const stage = document.createElement("div");
        stage.className = "seat-map__stage";
        stage.textContent = "ESCENARIO";
        this.container.appendChild(stage);

        if (seats.length === 0) {
            const empty = document.createElement("p");
            empty.className = "muted";
            empty.textContent = "Esperando datos del servidor...";
            this.container.appendChild(empty);
            return;
        }

        for (const zone of ZONE_ORDER) {
            const zoneSeats = seats.filter((seat) => seat.zone.name === zone);
            if (zoneSeats.length > 0) {
                this.container.appendChild(this.createZone(zone, zoneSeats, clientId));
            }
        }

        this.container.appendChild(this.createLegend());
    }

    createZone(zone, zoneSeats, clientId) {
        const zoneElement = document.createElement("div");
        zoneElement.className = "seat-map__zone";

        const zoneTitle = document.createElement("h3");
        zoneTitle.className = "seat-map__zone-title";
        zoneTitle.textContent = "Zona " + ZONE_NAMES[zone] + " · " + formatPrice(zoneSeats[0].price);
        zoneElement.appendChild(zoneTitle);

        // Agrupar las sillas de la zona por fila (A, B, C...)
        const rows = {};
        for (const seat of zoneSeats) {
            if (!rows[seat.row]) {
                rows[seat.row] = [];
            }
            rows[seat.row].push(seat);
        }

        for (const rowName of Object.keys(rows).sort()) {
            const rowElement = document.createElement("div");
            rowElement.className = "seat-map__row";

            const label = document.createElement("span");
            label.className = "seat-map__row-label";
            label.textContent = rowName;
            rowElement.appendChild(label);

            const rowSeats = rows[rowName].sort((a, b) => a.number - b.number);
            for (const seat of rowSeats) {
                rowElement.appendChild(this.createSeatButton(seat, clientId));
                if (seat.number === 5) {
                    const aisle = document.createElement("span");
                    aisle.className = "seat-map__aisle"; // pasillo central
                    rowElement.appendChild(aisle);
                }
            }
            zoneElement.appendChild(rowElement);
        }
        return zoneElement;
    }

    createSeatButton(seat, clientId) {
        const status = this.getSeatStatus(seat, clientId);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "seat seat--" + status;
        button.textContent = seat.number;
        button.title = seat.id + " · " + formatPrice(seat.price) + " · " + STATE_LABELS[status];

        // Las sillas vendidas o bloqueadas por otro no se pueden seleccionar
        if (status === "booked" || status === "locked") {
            button.disabled = true;
        }

        button.addEventListener("click", () => {
            this.onSeatClick(seat);
        });
        return button;
    }

    createLegend() {
        const legend = document.createElement("div");
        legend.className = "seat-map__legend";
        legend.innerHTML = `
            <span class="legend-item"><span class="seat seat--available seat--sample"></span>${STATE_LABELS.available}</span>
            <span class="legend-item"><span class="seat seat--mine seat--sample"></span>${STATE_LABELS.mine}</span>
            <span class="legend-item"><span class="seat seat--locked seat--sample"></span>${STATE_LABELS.locked}</span>
            <span class="legend-item"><span class="seat seat--booked seat--sample"></span>${STATE_LABELS.booked}</span>
        `;
        return legend;
    }
}
