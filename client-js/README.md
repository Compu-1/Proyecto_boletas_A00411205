# 🌐 client-js — Frontend Icesi Live Arena (JavaScript Vainilla + Webpack)

Single Page Application en **JavaScript moderno (ES6+, ES Modules)**, sin frameworks, empaquetada con **Webpack 5**. Se comunica con el servidor Java **exclusivamente por WebSocket** (`ws://<host>:10002`) usando la librería oficial **ZeroC Ice para JavaScript** (`ice@3.7`).

---

## 1. Requisitos
* Node.js 18 o superior (probado con Node 24) y npm.
* El servidor Java corriendo (`cd ../codigo_base && ./gradlew runServer`).

## 2. Scripts de npm

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias (`ice`, `webpack`, loaders...). |
| `npm start` | Genera el código Slice y levanta **webpack-dev-server en http://localhost:3000** con recarga en caliente. |
| `npm run build` | Genera el **bundle optimizado de producción en `dist/`** (minificado, con hash en el nombre). |
| `npm run slice` | Convierte `../codigo_base/common/src/main/slice/BookingService.ice` a JavaScript en `src/generated/`. Se ejecuta solo antes de `start` y `build` (scripts `prestart` / `prebuild`). |

## 3. Tooling

**Dependencias de ejecución:** `ice` (runtime RPC de ZeroC).

**Dependencias de desarrollo:**
* `webpack`, `webpack-cli` — empaquetador y su línea de comandos.
* `webpack-dev-server` — servidor de desarrollo (puerto 3000).
* `html-webpack-plugin` — genera `index.html` e inyecta automáticamente el `<script>` del bundle.
* `css-loader` + `style-loader` — permiten `import "./archivo.css"` desde JavaScript.
* `slice2js` — compilador del contrato Slice a JavaScript.

**`webpack.config.js`** (comentado línea a línea): `entry` → `src/index.js`; `output` → `dist/` con `contenthash` en producción; regla para `.css`; `resolve.fallback` para ignorar los módulos de Node (`net`, `fs`) que la librería `ice` solo usa fuera del navegador; `devServer` en el puerto 3000 accesible desde la red.

## 4. Arquitectura de componentes

```text
src/
├── index.html                 # Esqueleto con un contenedor por componente
├── index.js                   # Orquestador: estado, refresco, acciones del usuario
├── services/
│   └── bookingService.js      # ÚNICO módulo que habla con ZeroC Ice (proxy, llamadas RPC, errores)
├── components/                # Cada componente: una clase con una sola responsabilidad
│   ├── Header.js              # Evento, contadores en tiempo real y estado ONLINE/OFFLINE
│   ├── SeatMap.js             # Plano interactivo de 90 sillas por zona y fila
│   ├── Timer.js               # Cuenta regresiva de 90 s (alerta los últimos 15 s)
│   ├── CartPanel.js           # Sillas retenidas, total, quitar/liberar, ir a pagar
│   ├── CheckoutModal.js       # Formulario validado + comprobante RES-XXXXXX
│   ├── MyBookings.js          # Historial de compras del cliente
│   └── Toast.js               # Notificaciones de éxito / error
├── utils/
│   ├── clientId.js            # Identificador de sesión por pestaña (sessionStorage)
│   └── format.js              # Precios COP, mm:ss, nombres de zona, Ice.Long → número
├── styles/                    # Un CSS global + un CSS por componente (estilos desacoplados)
└── generated/                 # BookingService.js generado por slice2js (no se versiona)
```

**Flujo de datos (unidireccional):**

```text
 clic del usuario ─► Componente ─► callback ─► index.js ─► bookingService.js ─► WebSocket ─► Servidor Ice
                                                  │
 Componente.render(datos) ◄──── estado actualizado ◄──── respuesta / excepción
```

* Los **componentes no conocen a Ice**: solo reciben datos en `render(...)` y avisan acciones mediante callbacks.
* **`index.js`** guarda el estado (`seats`, `eventInfo`, `bookings`, `connected`) y redibuja.
* **Tiempo real:** cada 2 s se consulta `getAllSeats()` + `getEventInfo()` (polling); los componentes solo se redibujan si algo cambió.
* **Temporizador:** cada 1 s se recalcula el tiempo restante de cada silla; al llegar a 0 se llama `releaseSeat` y se avisa al usuario (el servidor también libera el bloqueo por su cuenta).

## 5. Requerimientos funcionales cubiertos

| RF | Dónde |
|---|---|
| RF-1 Aforo y precios en tiempo real | `Header`, `SeatMap`, refresco cada 2 s |
| RF-2 Bloqueo exclusivo 90 s | `SeatMap` → `lockSeat` (exclusión garantizada por el servidor `synchronized`) |
| RF-3 Temporizador y desbloqueo automático | `Timer`, `tick()` en `index.js`, `releaseExpiredLocks()` en el servidor |
| RF-4 Carrito y liberación manual | `CartPanel` (✕ por silla y "Liberar Sillas") → `releaseSeat` |
| RF-5 Checkout | `CheckoutModal` (nombre + correo validados) → `confirmBooking` → código `RES-XXXXXX` |
| RF-6 Mis reservas | `MyBookings` → `getMyBookings` |
| RF-7 Manejo de excepciones remotas | `getErrorMessage()` en `bookingService.js` + `Toast`; indicador OFFLINE y reconexión automática |

## 6. Prueba de concurrencia desde el navegador
1. `npm start` y abrir **dos ventanas** (o una normal y una de incógnito) en `http://localhost:3000`. Cada pestaña es un comprador distinto (ver "Tu sesión" en el encabezado).
2. Bloquear sillas en la ventana A: en la ventana B aparecen en amarillo ("bloqueada por otro") en máximo 2 s.
3. Hacer clic en la misma silla libre en ambas ventanas: solo una la obtiene; la otra recibe `SeatNotAvailableException`.
4. Confirmar la compra en A: en B la silla pasa a "vendida".

## 7. Despliegue en una VM (o en otro equipo de la red)
El cliente se conecta por defecto al **mismo host desde el que se abrió la página**, así que no hay que cambiar código:

1. En la VM: clonar el repositorio e instalar Java 17 y Node 18+.
2. Iniciar el servidor: `cd codigo_base && ./gradlew runServer` (escucha en `0.0.0.0`).
3. Iniciar el frontend: `cd client-js && npm install && npm start` (escucha en `0.0.0.0:3000`).
   * Alternativa producción: `npm run build` y servir `dist/` con cualquier servidor estático (`npx serve dist -l 3000`).
4. Abrir los puertos `3000` y `10002` en el firewall de la VM.
5. Desde cualquier equipo: `http://IP-DE-LA-VM:3000`. Para apuntar a otro servidor: `http://localhost:3000/?host=IP-DEL-SERVIDOR`.
