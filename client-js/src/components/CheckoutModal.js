// =========================================================================
// Componente CheckoutModal (ventana de confirmación de compra)
// Responsabilidad: pedir nombre y correo, validarlos, avisar a index.js
// para que llame a confirmBooking y mostrar el comprobante con el código.
// =========================================================================
import "../styles/modal.css";
import { formatPrice, formatSeconds, escapeHtml } from "../utils/format.js";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export class CheckoutModal {
    // onConfirm(name, email) -> lo implementa index.js (llama al servidor)
    constructor(container, onConfirm) {
        this.container = container;
        this.onConfirm = onConfirm;
        this.isOpen = false;
        this.showingReceipt = false;
    }

    open(seats, total, remainingSeconds) {
        this.isOpen = true;
        this.showingReceipt = false;
        const seatIds = seats.map((seat) => seat.id).join(", ");

        this.container.innerHTML = `
            <div class="modal-overlay">
                <div class="modal" role="dialog" aria-modal="true">
                    <div class="modal__header">
                        <h2>Datos del Comprador</h2>
                        <button type="button" class="modal__close" data-action="close" title="Cerrar">✕</button>
                    </div>
                    <p class="muted">Ingresa tu información para emitir el boleto.</p>

                    <div class="modal__summary">
                        <div>Sillas: <strong>${seatIds}</strong> · Valor total: <strong>${formatPrice(total)}</strong></div>
                        <div class="modal__remaining">Retención activa: <span data-role="remaining">${formatSeconds(remainingSeconds)}</span> restantes</div>
                    </div>

                    <form class="modal__form" novalidate>
                        <label for="customer-name">Nombre completo</label>
                        <input id="customer-name" name="name" type="text" placeholder="Estudiante Icesi" autocomplete="name">
                        <span class="field-error" data-error="name"></span>

                        <label for="customer-email">Correo electrónico</label>
                        <input id="customer-email" name="email" type="email" placeholder="estudiante@u.icesi.edu.co" autocomplete="email">
                        <span class="field-error" data-error="email"></span>

                        <p class="modal__error" data-role="error"></p>

                        <button type="submit" class="btn btn--primary" data-role="submit">Finalizar y Pagar</button>
                        <button type="button" class="btn btn--secondary" data-action="close">Volver al Plano</button>
                    </form>
                </div>
            </div>
        `;

        this.container.querySelectorAll("[data-action='close']").forEach((button) => {
            button.addEventListener("click", () => this.close());
        });

        const form = this.container.querySelector("form");
        form.addEventListener("submit", (event) => {
            event.preventDefault(); // evita que el navegador recargue la página
            this.handleSubmit(form);
        });

        this.container.querySelector("#customer-name").focus();
    }

    // Validación en el cliente (el servidor también valida)
    validate(name, email) {
        let valid = true;
        const nameError = this.container.querySelector("[data-error='name']");
        const emailError = this.container.querySelector("[data-error='email']");
        nameError.textContent = "";
        emailError.textContent = "";

        if (name.length < 3) {
            nameError.textContent = "Ingresa tu nombre completo (mínimo 3 caracteres).";
            valid = false;
        }
        if (!EMAIL_REGEX.test(email)) {
            emailError.textContent = "Ingresa un correo válido, por ejemplo nombre@dominio.com.";
            valid = false;
        }
        return valid;
    }

    async handleSubmit(form) {
        const name = form.elements.name.value.trim();
        const email = form.elements.email.value.trim();
        if (!this.validate(name, email)) {
            return;
        }

        const submitButton = this.container.querySelector("[data-role='submit']");
        submitButton.disabled = true;
        submitButton.textContent = "Procesando...";
        this.showError("");

        await this.onConfirm(name, email);

        // Si no se mostró el comprobante (hubo error), reactivar el botón
        if (this.isOpen && !this.showingReceipt) {
            submitButton.disabled = false;
            submitButton.textContent = "Finalizar y Pagar";
        }
    }

    // Lo llama index.js cada segundo mientras el modal está abierto
    updateRemaining(remainingSeconds) {
        const span = this.container.querySelector("[data-role='remaining']");
        if (span) {
            span.textContent = remainingSeconds === null ? "expirada" : formatSeconds(remainingSeconds);
        }
    }

    showError(message) {
        const errorElement = this.container.querySelector("[data-role='error']");
        if (errorElement) {
            errorElement.textContent = message;
        }
    }

    // result = BookingResult que devolvió el servidor
    showReceipt(result, name, email) {
        this.showingReceipt = true;
        this.container.innerHTML = `
            <div class="modal-overlay">
                <div class="modal" role="dialog" aria-modal="true">
                    <div class="receipt">
                        <p class="receipt__title">--- COMPROBANTE GENERADO ---</p>
                        <p>${result.message}</p>
                        <div class="receipt__code">CÓDIGO: ${result.bookingCode}</div>
                        <p><strong>Comprador:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
                        <p><strong>Sillas:</strong> ${result.seatIds.join(", ")}</p>
                        <p><strong>Total pagado:</strong> ${formatPrice(result.totalAmount)}</p>
                        <p class="muted">Guarda este código para ingresar al evento.</p>
                    </div>
                    <button type="button" class="btn btn--primary" data-action="close">Volver al Plano</button>
                </div>
            </div>
        `;
        this.container.querySelector("[data-action='close']").addEventListener("click", () => this.close());
    }

    close() {
        this.isOpen = false;
        this.showingReceipt = false;
        this.container.innerHTML = "";
    }
}
