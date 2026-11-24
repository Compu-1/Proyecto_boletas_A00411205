// Convierte el contrato Slice (BookingService.ice) del servidor Java a JavaScript.
// Así el cliente web y el servidor usan EXACTAMENTE el mismo contrato.
// Se ejecuta con: npm run slice  (y automáticamente antes de npm start / npm run build)
const slice2js = require("slice2js");

const args = [
    "../codigo_base/common/src/main/slice/BookingService.ice",
    "--output-dir",
    "src/generated"
];

const proceso = slice2js.compile(args, { stdio: "inherit" });

proceso.on("exit", (codigo) => {
    if (codigo === 0) {
        console.log("[slice] BookingService.js generado en src/generated/");
    }
    process.exit(codigo);
});
