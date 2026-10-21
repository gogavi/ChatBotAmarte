/**
 * Catálogo único de las 7 landings. Los ids son funnel_events.proyecto.
 */
const assert = require("assert");
const { LANDINGS, resolveLanding, landingBrowserOrigins } = require("../config/landings");

const EXPECTED = [
  {
    id: "suite-jacuzzi",
    nombre: "Suite Jacuzzi",
    url: "https://microservicio-suite-jacuzzi.vercel.app",
    suites: ["Suite Jacuzzi"],
  },
  {
    id: "promo-suite-jacuzzi",
    nombre: "Promo Suite Jacuzzi",
    url: "https://microservicio-promo-suite-jacuzzi.vercel.app",
    suites: ["Suite Jacuzzi"],
  },
  {
    id: "promo-suite-amarte",
    nombre: "Promo Suite Amarte",
    url: "https://microservicio-promo-suite-amarte.vercel.app",
    suites: ["Suite Amarte"],
  },
  {
    id: "tematicas",
    nombre: "Suites temáticas",
    url: "https://microservicio-suite-tematicas.vercel.app",
    suites: ["Suite Árabe", "Suite Queen", "Suite Gótica", "Suite Diamante"],
  },
  {
    id: "suite-sauna-jacuzzi",
    nombre: "Gold, Rubí y Zafiro",
    url: "https://microservicio-suite-sauna-jacuzzi.vercel.app",
    suites: ["Suite Gold", "Suite Rubí", "Suite Zafiro"],
  },
  {
    id: "suite-gamer",
    nombre: "Suite Gamer",
    url: "https://microservicio-suite-gamer.vercel.app",
    suites: ["Suite Gamer"],
  },
  {
    id: "reservas",
    nombre: "Pre-reserva",
    url: "https://microservicio-reservas.vercel.app",
    suites: [],
  },
];

assert.strictEqual(LANDINGS.length, 7);
assert.deepStrictEqual(
  LANDINGS.map((landing) => landing.id),
  EXPECTED.map((row) => row.id)
);

for (const row of EXPECTED) {
  const landing = resolveLanding(row.id);
  assert.ok(landing, row.id);
  assert.strictEqual(landing.nombre, row.nombre);
  assert.strictEqual(landing.url, row.url);
  assert.deepStrictEqual(
    landing.suites.map((suite) => suite.label),
    row.suites
  );
  assert.ok(!landing.url.includes("/producto/"));
}

assert.strictEqual(resolveLanding("  Suite-Jacuzzi  ").id, "suite-jacuzzi");
assert.strictEqual(resolveLanding(""), null);
assert.strictEqual(resolveLanding("no-existe"), null);
assert.strictEqual(resolveLanding(null), null);
assert.strictEqual(resolveLanding("https://deluxe.amartesuite.com"), null);

const sauna = resolveLanding("suite-sauna-jacuzzi");
assert.deepStrictEqual(sauna.aliasUrls, ["https://deluxe.amartesuite.com"]);
assert.strictEqual(resolveLanding("suite-gamer").suites[0].catalogId, null);
assert.strictEqual(
  resolveLanding("suite-jacuzzi").suites[0].catalogId,
  "suite_vip_jacuzzi"
);
assert.strictEqual(resolveLanding("promo-suite-jacuzzi").offer, "promo-jacuzzi");
assert.strictEqual(resolveLanding("reservas").kind, "form");

const origins = landingBrowserOrigins();
assert.deepStrictEqual(origins, [
  "https://microservicio-suite-jacuzzi.vercel.app",
  "https://microservicio-promo-suite-jacuzzi.vercel.app",
  "https://microservicio-promo-suite-amarte.vercel.app",
  "https://microservicio-suite-tematicas.vercel.app",
  "https://microservicio-suite-sauna-jacuzzi.vercel.app",
  "https://deluxe.amartesuite.com",
  "https://microservicio-suite-gamer.vercel.app",
  "https://microservicio-reservas.vercel.app",
]);

console.log("landingsCatalog.test.js ok");
