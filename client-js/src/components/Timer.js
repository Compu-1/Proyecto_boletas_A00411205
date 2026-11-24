// =========================================================================
// Componente Timer (cuenta regresiva)
// Responsabilidad: mostrar cuánto tiempo le queda a la retención que vence
// primero. index.js lo actualiza cada segundo con render(segundos).
// =========================================================================
import "../styles/timer.css";
import { formatSeconds } from "../utils/format.js";

const WARNING_SECONDS = 15; // los últimos 15 s se pinta en rojo

export class Timer {
    constructor(container, totalSeconds) {
        this.container = container;
        this.totalSeconds = totalSeconds; // 90
    }

    // remainingSeconds = null cuando el cliente no tiene sillas retenidas
    render(remainingSeconds) {
        if (remainingSeconds === null) {
            this.container.innerHTML = `
                <div class="timer timer--idle">
                    <span class="timer__label">Tiempo de retención</span>
                    <span class="timer__value">--:--</span>
                </div>
                <p class="timer__hint">Selecciona una silla para iniciar tu retención de ${this.totalSeconds} segundos.</p>
            `;
            return;
        }

        const isWarning = remainingSeconds <= WARNING_SECONDS;
        const percent = Math.max(0, Math.min(100, (remainingSeconds / this.totalSeconds) * 100));

        this.container.innerHTML = `
            <div class="timer ${isWarning ? "timer--warning" : ""}">
                <span class="timer__label">Tiempo de retención</span>
                <span class="timer__value">${formatSeconds(remainingSeconds)}</span>
            </div>
            <div class="timer__bar">
                <div class="timer__bar-fill ${isWarning ? "timer__bar-fill--warning" : ""}" style="width: ${percent}%"></div>
            </div>
            <p class="timer__hint">${isWarning ? "¡Apúrate! Tus sillas están por liberarse." : "Confirma tu compra antes de que el tiempo termine."}</p>
        `;
    }
}
