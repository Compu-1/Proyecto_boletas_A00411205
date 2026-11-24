// =========================================================================
// Componente Toast (notificaciones flotantes)
// Responsabilidad: mostrar mensajes cortos de éxito, aviso o error que
// desaparecen solos después de unos segundos.
// =========================================================================
import "../styles/toast.css";

const DURATION_MS = 4000;

export class Toast {
    constructor(container) {
        this.container = container;
    }

    // type: "success" | "error" | "warning" | "info"
    show(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = "toast toast--" + type;
        toast.textContent = message;
        this.container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, DURATION_MS);
    }
}
