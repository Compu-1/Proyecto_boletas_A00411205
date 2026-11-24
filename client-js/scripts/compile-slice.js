// Convierte el contrato Slice (BookingService.ice) del servidor Java a JavaScript.
// Así el cliente web y el servidor usan EXACTAMENTE el mismo contrato.
// Se ejecuta con: npm run slice  (y automáticamente antes de npm start / npm run build)
const fs = require("fs");
const slice2js = require("slice2js");

// La carpeta src/generated/ no se sube a GitHub (.gitignore), así que en un
// clon nuevo no existe. slice2js no la crea solo, por eso la creamos aquí.
fs.mkdirSync("src/generated", { recursive: true });

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
