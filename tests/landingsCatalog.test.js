/**
 * Catálogo único de las 7 landings. Los ids son funnel_events.proyecto.
 */
const assert = require("assert");
const {
  LANDINGS,
  resolveLanding,
  resolveLandingByPageUrl,
  resolveChatLanding,
  landingBrowserOrigins,
} = require("../config/landings");

const EXPECTED = [
  {
    id: "suite-jacuzzi",
    nombre: "Suite Jacuzzi",
    url: "https://microservicio-suite-jacuzzi.vercel.app",
    aliasUrls: ["https://suitejacuzzi.amartesuite.com"],
    suites: ["Suite Jacuzzi"],
  },
  {
    id: "promo-suite-jacuzzi",
    nombre: "Promo Suite Jacuzzi",
    url: "https://microservicio-promo-suite-jacuzzi.vercel.app",
    aliasUrls: ["https://promojacuzzi.amartesuite.com"],
    suites: ["Suite Jacuzzi"],
  },
  {
    id: "promo-suite-amarte",
    nombre: "Promo Suite Amarte",
    url: "https://microservicio-promo-suite-amarte.vercel.app",
    aliasUrls: ["https://promoamarte.amartesuite.com"],
    suites: ["Suite Amarte"],
  },
  {
    id: "tematicas",
    nombre: "Suites temáticas",
    url: "https://microservicio-suite-tematicas.vercel.app",
    aliasUrls: ["https://tematica.amartesuite.com"],
    suites: ["Suite Árabe", "Suite Queen", "Suite Gótica", "Suite Diamante"],
  },
  {
    id: "suite-sauna-jacuzzi",
    nombre: "Gold, Rubí y Zafiro",
    url: "https://microservicio-suite-sauna-jacuzzi.vercel.app",
    aliasUrls: ["https://deluxe.amartesuite.com"],
    suites: ["Suite Gold", "Suite Rubí", "Suite Zafiro"],
  },
  {
    id: "suite-gamer",
    nombre: "Suite Gamer",
    url: "https://microservicio-suite-gamer.vercel.app",
    aliasUrls: ["https://suitegamer.amartesuite.com"],
    suites: ["Suite Gamer"],
  },
  {
    id: "reservas",
    nombre: "Pre-reserva",
    url: "https://microservicio-reservas.vercel.app",
    aliasUrls: ["https://reservas.amartesuite.com"],
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
  assert.deepStrictEqual([...landing.aliasUrls], row.aliasUrls);
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
  "https://suitejacuzzi.amartesuite.com",
  "https://microservicio-promo-suite-jacuzzi.vercel.app",
  "https://promojacuzzi.amartesuite.com",
  "https://microservicio-promo-suite-amarte.vercel.app",
  "https://promoamarte.amartesuite.com",
  "https://microservicio-suite-tematicas.vercel.app",
  "https://tematica.amartesuite.com",
  "https://microservicio-suite-sauna-jacuzzi.vercel.app",
  "https://deluxe.amartesuite.com",
  "https://microservicio-suite-gamer.vercel.app",
  "https://suitegamer.amartesuite.com",
  "https://microservicio-reservas.vercel.app",
  "https://reservas.amartesuite.com",
]);

const PAGE_MAP = [
  ["https://suitejacuzzi.amartesuite.com", "suite-jacuzzi"],
  ["https://suitejacuzzi.amartesuite.com/", "suite-jacuzzi"],
  ["https://suitejacuzzi.amartesuite.com/algo", "suite-jacuzzi"],
  ["https://promojacuzzi.amartesuite.com", "promo-suite-jacuzzi"],
  ["https://promoamarte.amartesuite.com", "promo-suite-amarte"],
  ["https://tematica.amartesuite.com", "tematicas"],
  ["https://deluxe.amartesuite.com", "suite-sauna-jacuzzi"],
  ["https://suitegamer.amartesuite.com", "suite-gamer"],
  ["https://reservas.amartesuite.com", "reservas"],
  ["https://microservicio-suite-gamer.vercel.app/", "suite-gamer"],
  ["https://microservicio-suite-jacuzzi.vercel.app", "suite-jacuzzi"],
];

for (const [page, id] of PAGE_MAP) {
  const landing = resolveLandingByPageUrl(page);
  assert.ok(landing, page);
  assert.strictEqual(landing.id, id, page);
}

assert.strictEqual(resolveLandingByPageUrl("https://amartesuite.com/"), null);
assert.strictEqual(resolveLandingByPageUrl("https://www.amartesuite.com/"), null);
assert.strictEqual(resolveLandingByPageUrl("https://otro.amartesuite.com/"), null);
assert.strictEqual(resolveLandingByPageUrl("http://suitegamer.amartesuite.com/"), null);
assert.strictEqual(
  resolveLandingByPageUrl("https://foo.gogavis-projects.vercel.app/"),
  null
);
assert.strictEqual(resolveLandingByPageUrl("sin especificar"), null);

assert.strictEqual(
  resolveChatLanding("suite-jacuzzi", "https://suitegamer.amartesuite.com/").id,
  "suite-jacuzzi"
);
assert.strictEqual(
  resolveChatLanding("", "https://suitegamer.amartesuite.com/ruta").id,
  "suite-gamer"
);
assert.strictEqual(
  resolveChatLanding("no-existe", "https://promoamarte.amartesuite.com/").id,
  "promo-suite-amarte"
);
assert.strictEqual(resolveChatLanding("", "https://www.amartesuite.com/"), null);
assert.strictEqual(resolveChatLanding(undefined, "https://amartesuite.com/"), null);

console.log("landingsCatalog.test.js ok");
