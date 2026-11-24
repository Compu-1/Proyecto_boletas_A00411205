// =========================================================================
// Configuración de Webpack
// Webpack toma nuestro punto de entrada (src/index.js), sigue todos los
// "import" (componentes, estilos, librería ice, código generado) y los
// empaqueta en un único archivo JavaScript (bundle) que el navegador entiende.
// =========================================================================
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (env, argv) => {
    const esProduccion = argv.mode === "production";

    return {
        // 1. Punto de entrada: el primer archivo que se ejecuta
        entry: "./src/index.js",

        // 2. Salida: dónde y con qué nombre queda el bundle
        output: {
            path: path.resolve(__dirname, "dist"),
            // [contenthash] cambia cuando cambia el código -> evita caché vieja en producción
            filename: esProduccion ? "bundle.[contenthash].js" : "bundle.js",
            clean: true // borra dist/ antes de cada build
        },

        // 3. Loaders: le enseñan a Webpack a "importar" archivos que no son JS
        module: {
            rules: [
                {
                    test: /\.css$/i,
                    // css-loader lee el .css; style-loader lo inyecta en <style> dentro del HTML
                    use: ["style-loader", "css-loader"]
                }
            ]
        },

        // 4. La librería "ice" también trae código para Node.js (sockets TCP con "net",
        //    archivos con "fs"). En el navegador no existen: le decimos a Webpack que
        //    los ignore. En el navegador Ice usa WebSocket.
        resolve: {
            fallback: {
                net: false,
                fs: false
            }
        },

        // 5. Plugins: generan dist/index.html e inyectan automáticamente el <script> del bundle
        plugins: [
            new HtmlWebpackPlugin({
                template: "./src/index.html",
                title: "Icesi Live Arena — Reserva de Boletas"
            })
        ],

        // 6. Mapas de código para depurar en el navegador (solo desarrollo)
        devtool: esProduccion ? false : "eval-source-map",

        // 7. Servidor de desarrollo: npm start -> http://localhost:3000
        devServer: {
            port: 3000,
            host: "0.0.0.0",      // acepta conexiones desde otros equipos (útil en la VM)
            allowedHosts: "all",
            open: false,
            hot: true,
            client: {
                overlay: { warnings: false, errors: true }
            }
        },

        // El código generado por slice2js usa "require" de forma dinámica;
        // es un aviso esperado e inofensivo, así que lo ocultamos.
        ignoreWarnings: [/Critical dependency: require function is used/],

        performance: {
            hints: false // la librería ice pesa ~1 MB; no es un error
        }
    };
};
