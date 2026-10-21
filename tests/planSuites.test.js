/**
 * Suites que Guillermo ata a cada plan. Un solo dato en config/planSuites.js.
 */
const assert = require("assert");
const {
  ruleForPlan,
  formatPlanSuiteRulesForPrompt,
  PLAN_CHOICE_GROUP,
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

const amarte = ruleForPlan("Plan Amarte");
assert.strictEqual(amarte.mode, "only");
assert.deepStrictEqual([...amarte.suites], ["Suite Amarte"]);

const erotico = ruleForPlan("Plan Erótico");
assert.strictEqual(erotico.mode, "recommend");
assert.deepStrictEqual(
  [...erotico.suites],
  ["Suite Queen", "Suite Gótica", "Suite Diamante"]
);
assert.ok(!erotico.suites.includes("Suite Árabe"));
assert.deepStrictEqual([...erotico.exclude], []);

const cama = ruleForPlan("Plan Cama Movimiento");
assert.strictEqual(cama.mode, "only");
assert.deepStrictEqual([...cama.suites], ["Suite Movimiento"]);

const rulesText = formatPlanSuiteRulesForPrompt();
assert.ok(rulesText.includes("Plan Húmedo"));
assert.ok(rulesText.includes("solo Suite Jacuzzi"));
assert.ok(rulesText.includes("Plan Cabaña"));
assert.ok(rulesText.includes("Suite Cabaña"));
assert.ok(rulesText.includes("Plan Movimiento"));
assert.ok(rulesText.includes("Suite Movimiento"));
assert.ok(rulesText.includes("No recomiendes Suite Gótica"));
assert.ok(rulesText.includes("Plan Amarte"));
assert.ok(rulesText.includes("solo Suite Amarte"));
assert.ok(rulesText.includes("Plan Erótico"));
assert.ok(rulesText.includes("Suite Queen, Suite Gótica, Suite Diamante"));
assert.ok(rulesText.includes("Plan Cama Movimiento"));
assert.ok(rulesText.includes("solo Suite Movimiento"));
assert.ok(!/\$\s*\d/.test(rulesText));
assert.ok(!rulesText.includes("120"));

const choiceText = rulesText.split("## Elección").slice(1).join("## Elección");
assert.ok(choiceText.includes("puede escoger"));
assert.ok(choiceText.includes("Suite Queen"));
assert.ok(choiceText.includes("Suite Gótica"));
assert.ok(choiceText.includes("Suite Rubí"));
assert.ok(choiceText.includes("Suite Diamante"));
assert.ok(choiceText.includes("Suite Árabe"));
assert.ok(choiceText.includes("Suite Gamer"));
assert.ok(!choiceText.includes("Suite Gold"));
assert.ok(!choiceText.includes("120"));
assert.deepStrictEqual(
  [...PLAN_CHOICE_GROUP.suites],
  ["Suite Queen", "Suite Gótica", "Suite Rubí", "Suite Diamante", "Suite Árabe"]
);
assert.ok(!PLAN_CHOICE_GROUP.suites.includes("Suite Gold"));
assert.ok(!PLAN_CHOICE_GROUP.suites.includes("Suite Gamer"));
assert.ok(ruleForPlan("Plan Romántico").suites.includes("Suite Gold"));

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
assert.deepStrictEqual(
  landingsAskedInMessage("quiero el Plan Amarte", gamer).map((landing) => landing.id),
  ["promo-suite-amarte"]
);
assert.deepStrictEqual(
  landingsAskedInMessage("Plan Erótico", gamer).map((landing) => landing.id),
  ["tematicas"]
);
assert.deepStrictEqual(
  landingsAskedInMessage("Plan Cama Movimiento", gamer).map((landing) => landing.id),
  []
);

const romQueen = landingsAskedInMessage(
  "Plan Romántico en la Suite Queen",
  gamer
).map((landing) => landing.id);
assert.ok(romQueen.includes("tematicas"));
assert.ok(!romQueen.includes("suite-sauna-jacuzzi"));

const romGotica = landingsAskedInMessage(
  "quiero el Plan Romántico en la Suite Gótica",
  gamer
).map((landing) => landing.id);
assert.deepStrictEqual(romGotica, ["tematicas"]);

const cumpleRubi = landingsAskedInMessage(
  "Plan Cumpleaños en Suite Rubí",
  gamer
).map((landing) => landing.id);
assert.deepStrictEqual(cumpleRubi, ["suite-sauna-jacuzzi"]);

const eroticoGamer = landingsAskedInMessage(
  "Plan Erótico en Suite Gamer",
  gamer
).map((landing) => landing.id);
assert.deepStrictEqual(eroticoGamer, ["tematicas"]);

const romChosenReply = finishLandingReply(
  {
    landing: gamer,
    pricesAvailable: true,
    allowedAmounts: new Set(),
    addendum: "x",
  },
  "Puedes escogerla.",
  "Plan Romántico en la Suite Queen"
);
assert.ok(romChosenReply.includes("https://microservicio-suite-tematicas.vercel.app"));
assert.ok(
  !romChosenReply.includes("https://microservicio-suite-sauna-jacuzzi.vercel.app")
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
  assert.strictEqual(humedoQuote.suiteAdvice.choice, null);
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

  const amarteQuote = await lookupCatalogPrice({
    suite: "Plan Amarte",
    date: "2026-10-21",
    duration: "6 horas",
  });
  assert.strictEqual(amarteQuote.priceCop, null);
  assert.strictEqual(amarteQuote.decorationIncluded, true);
  assert.strictEqual(amarteQuote.suiteAdvice.mode, "only");
  assert.strictEqual(amarteQuote.suiteAdvice.suites[0].name, "Suite Amarte");
  assert.strictEqual(amarteQuote.suiteAdvice.suites[0].priceCop, null);
  assert.strictEqual(
    amarteQuote.suiteAdvice.suites[0].landingUrl,
    "https://microservicio-promo-suite-amarte.vercel.app"
  );

  const eroticoQuote = await lookupCatalogPrice({
    suite: "Plan Erótico",
    date: "2026-10-21",
    duration: "6 horas",
  });
  assert.strictEqual(eroticoQuote.suiteAdvice.mode, "recommend");
  assert.deepStrictEqual(
    eroticoQuote.suiteAdvice.suites.map((suite) => suite.name),
    ["Suite Queen", "Suite Gótica", "Suite Diamante"]
  );
  assert.ok(
    eroticoQuote.suiteAdvice.suites.every(
      (suite) =>
        suite.landingUrl === "https://microservicio-suite-tematicas.vercel.app" &&
        suite.priceCop === null
    )
  );
  assert.deepStrictEqual(eroticoQuote.suiteAdvice.exclude, []);
  assert.strictEqual(eroticoQuote.suiteAdvice.choice.samePrice, true);
  assert.deepStrictEqual(
    eroticoQuote.suiteAdvice.choice.suites,
    ["Suite Queen", "Suite Gótica", "Suite Rubí", "Suite Diamante", "Suite Árabe"]
  );
  assert.ok(!JSON.stringify(eroticoQuote.suiteAdvice.choice).includes("120"));

  const romQuote = await lookupCatalogPrice({
    suite: "Plan Romántico",
    date: "2026-10-21",
    duration: "6 horas",
  });
  assert.ok(romQuote.suiteAdvice.suites.some((suite) => suite.name === "Suite Gold"));
  assert.ok(romQuote.suiteAdvice.exclude.includes("Suite Gótica"));
  assert.ok(!romQuote.suiteAdvice.choice.suites.includes("Suite Gold"));
  assert.ok(romQuote.suiteAdvice.choice.suites.includes("Suite Gótica"));

  const camaQuote = await lookupCatalogPrice({
    suite: "Plan Cama Movimiento",
    date: "2026-10-21",
    duration: "6 horas",
  });
  assert.strictEqual(camaQuote.suiteAdvice.mode, "only");
  assert.strictEqual(camaQuote.suiteAdvice.suites[0].name, "Suite Movimiento");
  assert.strictEqual(camaQuote.suiteAdvice.suites[0].landingUrl, null);
  assert.strictEqual(camaQuote.suiteAdvice.suites[0].priceCop, null);

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

  setRoomRatesCacheForTests(
    new Map([
      [
        "Suite Amarte",
        {
          name: "Suite Amarte",
          kind: "suite",
          weekday: { h6: 180000 },
          weekend: {},
        },
      ],
      [
        "Suite Queen",
        {
          name: "Suite Queen",
          kind: "suite",
          weekday: { h6: 260000 },
          weekend: {},
        },
      ],
      [
        "Plan Amarte",
        {
          name: "Plan Amarte",
          kind: "plan",
          weekday: { h6: 210000 },
          weekend: {},
        },
      ],
      [
        "Plan Erótico",
        {
          name: "Plan Erótico",
          kind: "plan",
          weekday: { h6: 190000 },
          weekend: {},
        },
      ],
    ])
  );
  const pricedAmarte = await lookupCatalogPrice({
    suite: "Plan Amarte",
    date: "2026-10-21",
    duration: "6 horas",
  });
  assert.strictEqual(pricedAmarte.priceCop, 210000);
  assert.strictEqual(pricedAmarte.suiteAdvice.suites[0].priceCop, 180000);

  const pricedErotico = await lookupCatalogPrice({
    suite: "Plan Erótico",
    date: "2026-10-21",
    duration: "6 horas",
  });
  assert.strictEqual(pricedErotico.priceCop, 190000);
  assert.deepStrictEqual(
    pricedErotico.suiteAdvice.suites.map((suite) => suite.priceCop),
    [260000, null, null]
  );

  resetRoomRatesCache();
  console.log("planSuites.test.js: ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
