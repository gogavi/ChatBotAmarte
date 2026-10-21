/**
 * Extras de suite: misma caché que room_rates. Sin fila, sin monto.
 */
const assert = require("assert");
const {
  rowsToExtrasMap,
  extrasApplicableToNames,
  setRoomExtrasCacheForTests,
  resetRoomRatesCache,
  setRoomRatesCacheForTests,
  getRoomExtrasCatalog,
  CACHE_TTL_MS,
} = require("../services/roomRatesCatalog");
const { beginLandingTurn, finishLandingReply } = require("../services/landingPolicy");
const { lookupCatalogPrice } = require("../services/catalogLookup");
const { ensurePromoBlockOnExactQuote } = require("../services/suiteChatEnrichment");

assert.strictEqual(CACHE_TTL_MS, 5 * 60 * 1000);

const parsed = rowsToExtrasMap([
  {
    code: "persona_adicional",
    nombre: "Persona adicional",
    precio: "60000",
    applies_to: "*",
    activo: true,
  },
  {
    code: "decoracion_sencillas_cabana",
    nombre: "Decoración",
    precio: 0,
    applies_to: "Suite Amarte",
    activo: true,
  },
  {
    code: "hora_adicional",
    nombre: "Hora suelta",
    precio: 30000,
    applies_to: "Suite Sencilla",
    activo: false,
  },
  { code: "", nombre: "Vacío", precio: 1000, applies_to: "*", activo: true },
]);
assert.strictEqual(parsed.size, 1);
assert.strictEqual(parsed.get("persona_adicional").precio, 60000);
assert.strictEqual(parsed.get("persona_adicional").appliesTo, "*");

const seeded = rowsToExtrasMap([
  {
    code: "persona_adicional",
    nombre: "Persona adicional",
    precio: 60000,
    applies_to: "*",
    activo: true,
  },
  {
    code: "decoracion_sencillas_cabana",
    nombre: "Decoración sencillas y cabaña",
    precio: 100000,
    applies_to: "Suite Amarte,Suite Cabaña,Suite Movimiento,Suite Sencilla",
    activo: true,
  },
  {
    code: "decoracion_vip_tematicas_jacuzzi_sauna",
    nombre: "Decoración VIP, temáticas, jacuzzi y sauna",
    precio: 120000,
    applies_to:
      "Suite Diamante,Suite Gold,Suite Rubí,Suite Zafiro,Suite Árabe,Suite Gótica,Suite Queen,Suite Jacuzzi",
    activo: true,
  },
  {
    code: "hora_adicional",
    nombre: "Hora suelta",
    precio: 30000,
    applies_to: "Suite Sencilla",
    activo: true,
  },
]);

assert.strictEqual(
  extrasApplicableToNames(["Suite Jacuzzi"], null),
  null
);
const jacuzziExtras = extrasApplicableToNames(["Suite Jacuzzi"], seeded);
assert.deepStrictEqual(
  jacuzziExtras.map((row) => row.code).sort(),
  ["decoracion_vip_tematicas_jacuzzi_sauna", "persona_adicional"]
);
const sencillaExtras = extrasApplicableToNames(
  ["Suite Amarte", "Suite Cabaña", "Suite Movimiento"],
  seeded
);
assert.ok(
  sencillaExtras.some((row) => row.code === "decoracion_sencillas_cabana")
);
assert.ok(!sencillaExtras.some((row) => row.code === "hora_adicional"));

(async () => {
resetRoomRatesCache();
setRoomRatesCacheForTests(null);
setRoomExtrasCacheForTests(null);
assert.strictEqual(await getRoomExtrasCatalog(), null);

const rates = new Map([
  [
    "Suite Jacuzzi",
    {
      name: "Suite Jacuzzi",
      kind: "suite",
      weekday: { h4: 240000 },
      weekend: { h4: 260000 },
    },
  ],
]);

setRoomRatesCacheForTests(rates);
setRoomExtrasCacheForTests(null);
const without = await beginLandingTurn("suite-jacuzzi");
assert.strictEqual(without.allowedAmounts.has(60000), false);
assert.ok(without.addendum.includes("No inventes"));
const stripped = finishLandingReply(
  without,
  "La persona adicional vale $60.000.",
  "persona extra"
);
assert.ok(!stripped.includes("60"));
assert.ok(!stripped.includes("60000"));

setRoomExtrasCacheForTests(seeded);
const withExtras = await beginLandingTurn("suite-jacuzzi");
assert.strictEqual(withExtras.allowedAmounts.has(60000), true);
assert.strictEqual(withExtras.allowedAmounts.has(120000), true);
assert.strictEqual(withExtras.allowedAmounts.has(100000), false);
assert.strictEqual(withExtras.allowedAmounts.has(30000), false);
assert.strictEqual(withExtras.rateAmounts.has(240000), true);
assert.strictEqual(withExtras.rateAmounts.has(120000), false);
assert.strictEqual(withExtras.rateAmounts.has(60000), false);
assert.strictEqual(withExtras.pricesAvailable, true);
const onlyExtra = ensurePromoBlockOnExactQuote(
  "La decoración vale $120.000.",
  withExtras.rateAmounts
);
assert.ok(!onlyExtra.includes("DESCUENTO ESPECIAL"));
const packAndExtra = ensurePromoBlockOnExactQuote(
  "Decoración $120.000.\n4 h: $240.000",
  withExtras.rateAmounts
);
assert.ok(packAndExtra.includes("DESCUENTO ESPECIAL"));
assert.ok(packAndExtra.includes("$180.000"));
assert.ok(withExtras.addendum.includes("120.000") || withExtras.addendum.includes("120000"));
const kept = finishLandingReply(
  withExtras,
  "La decoración de esta suite vale $120.000.",
  "decoración"
);
assert.ok(kept.includes("120.000"));
const wrongTier = finishLandingReply(
  withExtras,
  "La decoración vale $100.000.",
  "decoración"
);
assert.ok(!wrongTier.includes("100"));

const quote = await lookupCatalogPrice({
  suite: "Suite VIP Jacuzzi",
  date: "2026-10-21",
  duration: "4 horas",
});
assert.strictEqual(quote.suite, "Suite Jacuzzi");
assert.strictEqual(quote.priceCop, 240000);
assert.ok(Array.isArray(quote.extras));
assert.deepStrictEqual(
  quote.extras.map((row) => row.code).sort(),
  ["decoracion_vip_tematicas_jacuzzi_sauna", "persona_adicional"]
);

setRoomRatesCacheForTests(
  new Map([
    [
      "Plan Romántico",
      {
        name: "Plan Romántico",
        kind: "plan",
        weekday: { h6: 200000 },
        weekend: {},
      },
    ],
  ])
);
const planQuote = await lookupCatalogPrice({
  suite: "Plan Romántico",
  date: "2026-10-21",
  duration: "6 horas",
});
assert.strictEqual(planQuote.priceCop, 200000);
assert.ok(Array.isArray(planQuote.extras));
assert.ok(!planQuote.extras.some((row) => row.code === "persona_adicional"));

setRoomRatesCacheForTests(rates);
const horaMiss = await lookupCatalogPrice({
  suite: "Suite Sencilla",
  date: "2026-10-21",
  duration: "4 horas",
});
assert.strictEqual(horaMiss.priceCop, null);
assert.ok(horaMiss.extras.some((row) => row.code === "hora_adicional"));

setRoomExtrasCacheForTests(null);
const quoteWithout = await lookupCatalogPrice({
  suite: "Suite Jacuzzi",
  date: "2026-10-21",
  duration: "4 horas",
});
assert.strictEqual(quoteWithout.priceCop, 240000);
assert.strictEqual(quoteWithout.extras, null);

resetRoomRatesCache();
console.log("roomExtrasCatalog.test.js: ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
