# 🎟️ Sistema Distribuido de Reserva de Boletas con ZeroC Ice (Java Backend & Vanilla JS Webpack)

Proyecto distribuido de arquitectura cliente-servidor desarrollado para el curso **Computación en Internet I (`09810 - TIC`)** de la **Universidad Icesi**.

---

## 📌 1. Visión General del Proyecto

El sistema modela una plataforma de venta y reserva de boletería para eventos masivos en vivo (auditorios y arenas). La solución se compone de dos grandes capas:

1. **Backend en Java (ZeroC Ice)** — esta carpeta:
   * Servicio RPC multi-protocolo escuchando simultáneamente en:
     * **Canal TCP (`10000`):** Para clientes de escritorio o pruebas nativas en Java.
     * **Canal WebSocket (`10002`):** Para clientes web en navegadores modernos mediante la librería oficial `ice`.
   * Administración del aforo del evento (90 sillas divididas en zonas: VIP, Platea y General).
   * Ciclo de vida de boletas: `AVAILABLE` (Disponible) ➔ `LOCKED` (Bloqueo temporal de 90 segundos para compra) ➔ `BOOKED` (Venta confirmada y facturada).

2. **Frontend en JavaScript Vainilla con Webpack** — carpeta [`../client-js`](../client-js/README.md).

---

## 🏗️ 2. Estructura

```text
codigo_base/
├── build.gradle          # Configuración raíz de compilación Gradle (Java 17, Ice 3.7.10, UTF-8)
├── settings.gradle       # Inclusión de submódulos (common, server, client)
├── gradlew / gradlew.bat # Gradle Wrapper ejecutable
├── common/               # Contrato Slice compartido
│   └── src/main/slice/BookingService.ice
├── server/               # Servidor ZeroC Ice multi-canal (TCP 10000 + WS 10002)
│   └── src/main/java/co/icesi/booking/server/
│       ├── BookingServerApp.java   # Punto de entrada y configuración de adaptadores
│       └── BookingServiceImpl.java # Lógica de negocio THREAD-SAFE
└── client/               # Cliente Java de consola para pruebas funcionales y de estrés
    └── src/main/java/co/icesi/booking/client/
        └── BookingClientApp.java   # Menú interactivo y test de concurrencia
```

---

## 🚀 3. Ejecución del Backend

> En Windows usa `.\gradlew.bat`; en Linux/macOS usa `./gradlew`.

### Paso 1: Iniciar el servidor ZeroC Ice
```bash
./gradlew runServer
```
El servidor queda escuchando en `TCP 10000` y `WebSocket 10002` e imprime las IPs de la máquina (útil para conectarse desde otros equipos o desde una VM).

### Paso 2: Cliente Java de pruebas (otra terminal)
```bash
./gradlew :client:runClient
```
Menú para consultar el aforo, ver el mapa de sillas, bloquear, liberar, confirmar compras y reiniciar el inventario.

### Paso 3: Prueba de estrés de concurrencia
```bash
./gradlew :client:runClient --args="--test-concurrency"
```
Lanza **10 hilos simultáneos** que intentan bloquear la silla `A-1` al mismo tiempo.

> Nota: el argumento `--args` debe ir sobre la tarea del subproyecto (`:client:runClient`). La tarea raíz `runClient` solo es un alias sin argumentos.

---

## 🔒 4. Corrección de la vulnerabilidad de concurrencia

### El problema (condición de carrera)
ZeroC Ice atiende cada petición en un hilo de su *thread pool* (`Ice.ThreadPool.Server.Size=10`, `SizeMax=100`). Todos esos hilos comparten **el mismo objeto** `BookingServiceImpl` y por tanto el mismo `HashMap` de sillas.

En `lockSeat` la secuencia era:

1. **Revisar** si la silla está `AVAILABLE`.
2. Simular latencia (`Thread.sleep(25)`).
3. **Marcarla** como `LOCKED`.

Como los pasos 1 y 3 no eran atómicos, los 10 hilos pasaban el paso 1 antes de que cualquiera llegara al paso 3 → **los 10 "ganaban" la misma silla** (sobreventa).

**Antes de la corrección:**
```text
Peticiones que creyeron ganar el bloqueo : 10
Peticiones correctamente rechazadas     : 0
[VULNERABILIDAD CONFIRMADA]: ¡CONDICIÓN DE CARRERA DETECTADA!
```

### La solución
1. **Exclusión mutua con `synchronized`:** todos los métodos públicos de `BookingServiceImpl` que leen o modifican el inventario (`lockSeat`, `releaseSeat`, `confirmBooking`, `getAllSeats`, `getEventInfo`, `getSeatsByZone`, `getSeat`, `getMyLockedSeats`, `getMyBookings`, `resetSeats`) son `synchronized`. Todos comparten el mismo monitor (`this`), así que solo un hilo a la vez puede estar dentro de cualquiera de ellos: "revisar + marcar" se vuelve una operación atómica.
2. **Liberación automática de bloqueos vencidos:** el método privado `releaseExpiredLocks()` se ejecuta al inicio de cada operación y devuelve a `AVAILABLE` las sillas cuyo bloqueo superó los 90 s. Así ningún cliente ve una silla "retenida" con el tiempo vencido.
3. **`confirmBooking` todo-o-nada y más estricto:** valida *todas* las sillas antes de modificar alguna y ahora exige que cada silla esté `LOCKED` **por el mismo cliente** con bloqueo vigente (antes permitía comprar una silla `AVAILABLE` sin bloquearla). El código de reserva tiene el formato `RES-XXXXXX`.
4. **Respuestas como copias (`clone()`)**: los métodos de consulta devuelven copias de las sillas, de modo que Ice serializa una "foto" consistente aunque otro hilo modifique la silla después.
5. **`releaseSeat`** solo permite liberar al cliente que tiene el bloqueo.
6. **Compilación en UTF-8** (`build.gradle`) para que las tildes compilen igual en Windows y Linux.

Se mantuvo el `Thread.sleep(25)` (simulación de latencia) para demostrar que la corrección funciona incluso con esa ventana de tiempo.

**Después de la corrección (repetida varias veces):**
```text
Peticiones que creyeron ganar el bloqueo : 1
Peticiones correctamente rechazadas     : 9
[SIN CONDICIÓN DE CARRERA]: Solo 1 hilo obtuvo el bloqueo. Servidor seguro.
```

### ¿Por qué `synchronized` y no otra cosa?
* Es el mecanismo de exclusión mutua nativo de Java, simple de leer y de razonar.
* Las operaciones son muy cortas (recorrer 90 sillas), por lo que un único candado no es un cuello de botella para este aforo.
* Alternativas válidas para escalar a miles de sillas: `ReentrantLock`, `ConcurrentHashMap` con `compute()` por silla, o un candado por silla.
