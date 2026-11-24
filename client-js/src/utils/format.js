// =========================================================================
// Funciones pequeñas de formato reutilizadas por varios componentes.
// =========================================================================

const currencyFormatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
});

// 120000 -> "$ 120.000"
export function formatPrice(value) {
    return currencyFormatter.format(value);
}

// 75 segundos -> "01:15"
export function formatSeconds(totalSeconds) {
    const seconds = Math.max(0, totalSeconds);
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    return mm + ":" + ss;
}

// Nombre legible de cada zona del Slice
export const ZONE_NAMES = {
    ZONEVIP: "VIP",
    ZONEPLATEA: "Platea",
    ZONEGENERAL: "General"
};

// Los "long" de Slice llegan a JavaScript como objetos Ice.Long.
// Esta función los convierte a un número normal.
export function longToNumber(value) {
    if (typeof value === "number") {
        return value;
    }
    return value.toNumber();
}

// Evita que un texto escrito por el usuario (ej. su nombre) se interprete
// como HTML al insertarlo con innerHTML. "<b>" se muestra literal.
export function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Fecha legible a partir de milisegundos
export function formatDateTime(milliseconds) {
    return new Date(milliseconds).toLocaleString("es-CO");
}
