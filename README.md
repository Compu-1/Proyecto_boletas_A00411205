# 🎟️ Icesi Live Arena — Sistema Distribuido de Reserva de Boletas

Proyecto final de **Computación en Internet I (09810 - TIC)** — Universidad Icesi, 2026-2.

Sistema de reserva de boletería para un concierto de **90 sillas** (VIP, Platea, General) con:

* **Backend Java 17 + ZeroC Ice 3.7** — RPC por TCP (`10000`) y WebSocket (`10002`), con la condición de carrera corregida (thread-safe).
* **Frontend JavaScript vainilla (ES6+) + Webpack 5** — plano interactivo, carrito, temporizador de 90 s, checkout con código `RES-XXXXXX`.

```text
Navegador (client-js, puerto 3000) ──WebSocket 10002──►┐
                                                        ├─► Servidor ZeroC Ice (codigo_base/server)
Cliente Java / prueba de estrés ─────TCP 10000────────►┘        90 sillas · synchronized
```

| Carpeta | Contenido | Documentación |
|---|---|---|
| [`codigo_base/`](codigo_base/) | Servidor Java, contrato Slice y cliente Java de pruebas | [README del backend](codigo_base/README.md) |
| [`client-js/`](client-js/) | Frontend con Webpack, componentes y estilos | [README del frontend](client-js/README.md) |

## ⚡ Ejecución rápida

```bash
# Terminal 1 — servidor
cd codigo_base
./gradlew runServer            # Windows: .\gradlew.bat runServer

# Terminal 2 — prueba de estrés de concurrencia (10 hilos, misma silla)
cd codigo_base
./gradlew :client:runClient --args="--test-concurrency"

# Terminal 3 — frontend
cd client-js
npm install
npm start                      # http://localhost:3000
npm run build                  # bundle de producción en dist/
```

## 🎥 Video demostrativo
Enlace: [https://canva.link/nityp92rwsou0p3](https://canva.link/nityp92rwsou0p3)
