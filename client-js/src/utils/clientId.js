// =========================================================================
// Identificador de sesión del cliente.
// El servidor necesita saber QUIÉN bloquea cada silla (parámetro clientId).
// Lo guardamos en sessionStorage: cada pestaña/ventana tiene el suyo, así
// dos ventanas abiertas se comportan como dos compradores distintos, y si
// recargas la página conservas el mismo id (y tus sillas bloqueadas).
// =========================================================================

const STORAGE_KEY = "icesi-live-arena-client-id";

function generateId() {
    // Math.random funciona en cualquier página (crypto.randomUUID exige https)
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return "WEB-" + random;
}

export function getClientId() {
    let id = sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
        id = generateId();
        sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
}
