/**
 * CORS: las 7 landings y deluxe.amartesuite.com. Sin comodín *.vercel.app.
 */
const assert = require("assert");
const { allowCorsOrigin } = require("../config/corsPolicy");

const extras = ["https://preview.ejemplo.test"];

function allows(origin) {
  assert.strictEqual(allowCorsOrigin(origin, extras), true, origin);
}

function blocks(origin) {
  assert.strictEqual(allowCorsOrigin(origin, extras), false, origin);
}

allows(undefined);
allows(null);
allows("https://amartesuite.com");
allows("https://www.amartesuite.com");
allows("http://localhost:5999");
allows("http://127.0.0.1:4173");
allows("https://preview.ejemplo.test");
allows("https://microservicio-suite-jacuzzi.vercel.app");
allows("https://microservicio-promo-suite-jacuzzi.vercel.app");
allows("https://microservicio-promo-suite-amarte.vercel.app");
allows("https://microservicio-suite-tematicas.vercel.app");
allows("https://microservicio-suite-sauna-jacuzzi.vercel.app");
allows("https://microservicio-suite-gamer.vercel.app");
allows("https://microservicio-reservas.vercel.app");
allows("https://deluxe.amartesuite.com");

blocks("https://evil.vercel.app");
blocks("https://microservicio-suite-jacuzzi.vercel.app.evil.com");
blocks("https://otro.amartesuite.com");
blocks("not a url");

console.log("corsPolicy.test.js ok");
