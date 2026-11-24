// =========================================================================
// Componente CartPanel (carrito / resumen de selección)
// Responsabilidad: listar las sillas que este cliente tiene retenidas, su
// tiempo restante y el total. Ofrece quitar una silla, liberar todas o ir
// al checkout. Las acciones se avisan a index.js mediante callbacks.
// =========================================================================
import "../styles/cart.css";
import { formatPrice, formatSeconds, ZONE_NAMES } from "../utils/format.js";

export class CartPanel {
    // callbacks = { onRemoveSeat(seatId), onReleaseAll(), onCheckout() }
    constructor(container, callbacks) {
        this.container = container;
        this.callbacks = callbacks;
    }

    // items = [{ seat, remainingSeconds }]
    render(items) {
        // Si son las mismas sillas que antes, solo se actualizan los tiempos
        // (así los botones no se recrean cada segundo y no se pierden clics).
        const seatIds = items.map((item) => item.seat.id).join(",");
        if (seatIds === this.lastSeatIds) {
            this.updateTimes(items);
            return;
        }
        this.lastSeatIds = seatIds;

        this.container.innerHTML = "";

        const title = document.createElement("h2");
        title.className = "card__title";
        title.textContent = "Resumen de Selección";
        this.container.appendChild(title);

        const subtitle = document.createElement("p");
        subtitle.className = "muted";
        subtitle.textContent = "Sillas en retención (" + items.length + "):";
        this.container.appendChild(subtitle);

        const list = document.createElement("ul");
        list.className = "cart__list";

        if (items.length === 0) {
            const empty = document.createElement("li");
            empty.className = "cart__empty";
            empty.textContent = "Aún no has seleccionado sillas. Haz clic en una silla disponible del plano.";
            list.appendChild(empty);
        }

        let total = 0;
        for (const item of items) {
            total += item.seat.price;
            list.appendChild(this.createItem(item));
        }
        this.container.appendChild(list);

        const totalRow = document.createElement("div");
        totalRow.className = "cart__total";
        totalRow.innerHTML = `<span>Total a pagar:</span><strong>${formatPrice(total)}</strong>`;
        this.container.appendChild(totalRow);

        const confirmButton = document.createElement("button");
        confirmButton.type = "button";
        confirmButton.className = "btn btn--primary";
        confirmButton.textContent = "Confirmar Reserva";
        confirmButton.disabled = items.length === 0;
        confirmButton.addEventListener("click", () => this.callbacks.onCheckout());
        this.container.appendChild(confirmButton);

        const releaseButton = document.createElement("button");
        releaseButton.type = "button";
        releaseButton.className = "btn btn--secondary";
        releaseButton.textContent = "Liberar Sillas";
        releaseButton.disabled = items.length === 0;
        releaseButton.addEventListener("click", () => this.callbacks.onReleaseAll());
        this.container.appendChild(releaseButton);
    }

    updateTimes(items) {
        for (const item of items) {
            const timeElement = this.container.querySelector("[data-seat-time='" + item.seat.id + "']");
            if (timeElement) {
                timeElement.textContent = "Expira en " + formatSeconds(item.remainingSeconds);
            }
        }
    }

    createItem(item) {
        const seat = item.seat;
        const li = document.createElement("li");
        li.className = "cart__item";

        const info = document.createElement("div");
        info.innerHTML = `
            <strong>Silla ${seat.id}</strong> <span class="muted">(${ZONE_NAMES[seat.zone.name]})</span>
            <div class="cart__item-time" data-seat-time="${seat.id}">Expira en ${formatSeconds(item.remainingSeconds)}</div>
        `;

        const price = document.createElement("span");
        price.className = "cart__item-price";
        price.textContent = formatPrice(seat.price);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "cart__remove";
        removeButton.title = "Quitar y liberar la silla " + seat.id;
        removeButton.textContent = "✕";
        removeButton.addEventListener("click", () => this.callbacks.onRemoveSeat(seat.id));

        li.appendChild(info);
        li.appendChild(price);
        li.appendChild(removeButton);
        return li;
    }
}
