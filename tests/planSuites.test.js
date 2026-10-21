/**
 * Suites que Guillermo ata a cada plan. Un solo dato en config/planSuites.js.
 */
const assert = require("assert");
const {
  ruleForPlan,
  formatPlanSuiteRulesForPrompt,
} = require("../config/planSuites");
const { landingsAskedInMessage, resolveLanding } = require("../config/landings");
const { finishLandingReply } = require("../services/landingPolicy");
const { lookupCatalogPrice } = require("../services/catalogLookup");
const { buildMartinaSystemPrompt } = require("../config/martinaSystemPrompt");
const {
  resetRoomRatesCache,
  setRoomRatesCacheForTests,
  setRoomExtrasCacheForTests,
} = require("../services/roomRatesCatalog");

const humedo = ruleForPlan("Plan Húmedo");
assert.strictEqual(humedo.mode, "only");
assert.deepStrictEqual([...humedo.suites], ["Suite Jacuzzi"]);

const cumple = ruleForPlan("Plan Cumpleaños");
assert.strictEqual(cumple.mode, "recommend");
assert.deepStrictEqual(
  [...cumple.suites],
  ["Suite Queen", "Suite Gótica", "Suite Árabe", "Suite Diamante"]
);

const romantico = ruleForPlan("Plan Romántico");
assert.strictEqual(romantico.mode, "recommend");
assert.deepStrictEqual(
  [...romantico.suites],
  ["Suite Rubí", "Suite Gold", "Suite Diamante"]
);
assert.ok(!romantico.suites.includes("Suite Gótica"));
assert.ok(romantico.exclude.includes("Suite Gótica"));

const cabana = ruleForPlan("Plan Cabaña");
assert.strictEqual(cabana.mode, "only");
assert.deepStrictEqual([...cabana.suites], ["Suite Cabaña"]);

const movimiento = ruleForPlan("Plan Movimiento");
assert.strictEqual(movimiento.mode, "only");
assert.deepStrictEqual([...movimiento.suites], ["Suite Movimiento"]);

assert.strictEqual(ruleForPlan("Plan Erótico"), null);
assert.strictEqual(ruleForPlan("Plan Amarte"), null);

const rulesText = formatPlanSuiteRulesForPrompt();
assert.ok(rulesText.includes("Plan Húmedo"));
assert.ok(rulesText.includes("solo Suite Jacuzzi"));
assert.ok(rulesText.includes("Plan Cabaña"));
assert.ok(rulesText.includes("Suite Cabaña"));
assert.ok(rulesText.includes("Plan Movimiento"));
assert.ok(rulesText.includes("Suite Movimiento"));
assert.ok(rulesText.includes("No recomiendes Suite Gótica"));
assert.ok(!/\$\s*\d/.test(rulesText));

const prompt = buildMartinaSystemPrompt({
  roomName: "Amarte Suite",
  pageUrl: "https://amartesuite.com/",
  referenceDate: "2026-10-21",
  referenceTime: "10:30",
  referenceWeekday: "miércoles",
  referenceIso: "2026-10-21T15:30:00.000Z",
});
assert.ok(prompt.includes(rulesText));

const gamer = resolveLanding("suite-gamer");
const humedoHits = landingsAskedInMessage(
  "El Plan Húmedo incluye jacuzzi y sauna",
  gamer
);
assert.ok(humedoHits.some((landing) => landing.id === "suite-jacuzzi"));
assert.ok(!humedoHits.some((landing) => landing.id === "suite-sauna-jacuzzi"));

const saunaHits = landingsAskedInMessage(
  "quiero la suite sauna",
  resolveLanding("suite-jacuzzi")
);
assert.ok(saunaHits.some((landing) => landing.id === "suite-sauna-jacuzzi"));

const romHits = landingsAskedInMessage("quiero el Plan Romántico", gamer);
assert.ok(romHits.some((landing) => landing.id === "tematicas"));
assert.ok(romHits.some((landing) => landing.id === "suite-sauna-jacuzzi"));

const cumHits = landingsAskedInMessage("Plan Cumpleaños", gamer);
assert.deepStrictEqual(
  cumHits.map((landing) => landing.id),
  ["tematicas"]
);

assert.deepStrictEqual(
  landingsAskedInMessage("Plan Cabaña", gamer).map((landing) => landing.id),
  []
);
assert.deepStrictEqual(
  landingsAskedInMessage("Plan Movimiento", gamer).map((landing) => landing.id),
  []
);

const linked = finishLandingReply(
  {
    landing: gamer,
    pricesAvailable: true,
    allowedAmounts: new Set(),
    addendum: "x",
  },
  "Claro.",
  "El Plan Húmedo incluye jacuzzi y sauna"
);
assert.ok(linked.includes("https://microservicio-suite-jacuzzi.vercel.app"));
assert.ok(!linked.includes("https://microservicio-suite-sauna-jacuzzi.vercel.app"));

(async () => {
  resetRoomRatesCache();
  setRoomRatesCacheForTests(null);
  setRoomExtrasCacheForTests(null);

  const humedoQuote = await lookupCatalogPrice({
    suite: "Plan Húmedo",
    date: "2026-10-21",
    duration: "6 horas",
  });
  assert.strictEqual(humedoQuote.priceCop, null);
  assert.strictEqual(humedoQuote.decorationIncluded, true);
  assert.strictEqual(humedoQuote.suiteAdvice.mode, "only");
  assert.strictEqual(humedoQuote.suiteAdvice.suites[0].name, "Suite Jacuzzi");
  assert.strictEqual(humedoQuote.suiteAdvice.suites[0].priceCop, null);
  assert.strictEqual(
    humedoQuote.suiteAdvice.suites[0].landingUrl,
    "https://microservicio-suite-jacuzzi.vercel.app"
  );
  assert.ok(!JSON.stringify(humedoQuote.suiteAdvice).includes("120000"));

  const cabQuote = await lookupCatalogPrice({
    suite: "Plan Cabaña",
    date: "2026-10-21",
    duration: "6 horas",
  });
  assert.strictEqual(cabQuote.suiteAdvice.mode, "only");
  assert.strictEqual(cabQuote.suiteAdvice.suites[0].name, "Suite Cabaña");
  assert.strictEqual(cabQuote.suiteAdvice.suites[0].landingUrl, null);
  assert.strictEqual(cabQuote.suiteAdvice.suites[0].priceCop, null);

  const movQuote = await lookupCatalogPrice({
    suite: "Plan Movimiento",
    date: "2026-10-21",
    duration: "6 horas",
  });
  assert.strictEqual(movQuote.suiteAdvice.mode, "only");
  assert.strictEqual(movQuote.suiteAdvice.suites[0].name, "Suite Movimiento");
  assert.strictEqual(movQuote.suiteAdvice.suites[0].landingUrl, null);
  assert.strictEqual(movQuote.suiteAdvice.suites[0].priceCop, null);

  setRoomRatesCacheForTests(
    new Map([
      [
        "Suite Jacuzzi",
        {
          name: "Suite Jacuzzi",
          kind: "suite",
          weekday: { h6: 240000 },
          weekend: {},
        },
      ],
      [
        "Plan Húmedo",
        {
          name: "Plan Húmedo",
          kind: "plan",
          weekday: { h6: 210000 },
          weekend: {},
        },
      ],
    ])
  );
  const priced = await lookupCatalogPrice({
    suite: "Plan Húmedo",
    date: "2026-10-21",
    duration: "6 horas",
  });
  assert.strictEqual(priced.priceCop, 210000);
  assert.strictEqual(priced.suiteAdvice.suites[0].priceCop, 240000);
  assert.strictEqual(priced.decorationIncluded, true);

  resetRoomRatesCache();
  console.log("planSuites.test.js: ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
