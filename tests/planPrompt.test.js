/**
 * El prompt nombra los 8 planes, copia lo que incluye cada uno y,
 * si piden decoración, ofrece primero el plan y después el extra suelto.
 */
const assert = require("assert");
const { includesForPlan } = require("../config/planCatalog");
const { formatSaunaMentionForPrompt, SAUNA_MENTION_SUITES } = require("../config/saunaMention");
const { PLAN_CHOICE_GROUP, PLAN_SUITE_RULES } = require("../config/planSuites");
const { buildMartinaSystemPrompt } = require("../config/martinaSystemPrompt");
const {
  canonicalPlanNames,
  formatPlanIncludesForPrompt,
  formatDecorationPolicyForPrompt,
  formatPlansForPrompt,
} = require("../config/planPrompt");
const { lookupCatalogPrice } = require("../services/catalogLookup");
const { beginPriceTurn, finishLandingReply } = require("../services/landingPolicy");
const {
  resetRoomRatesCache,
  setRoomRatesCacheForTests,
  setRoomExtrasCacheForTests,
  rowsToExtrasMap,
} = require("../services/roomRatesCatalog");

const EIGHT = [
  "Plan Amarte",
  "Plan Cabaña",
  "Plan Cama Movimiento",
  "Plan Cumpleaños",
  "Plan Erótico",
  "Plan Húmedo",
  "Plan Movimiento",
  "Plan Romántico",
];

assert.deepStrictEqual(canonicalPlanNames(), EIGHT);
assert.strictEqual(new Set(PLAN_SUITE_RULES.map((rule) => rule.plan)).size, 8);

const prompt = buildMartinaSystemPrompt({
  roomName: "Amarte Suite",
  pageUrl: "https://amartesuite.com/",
  referenceDate: "2026-10-21",
  referenceTime: "10:30",
  referenceWeekday: "miércoles",
  referenceIso: "2026-10-21T15:30:00.000Z",
});
const plansText = formatPlansForPrompt();
assert.ok(prompt.includes(plansText));
assert.ok(
  prompt.includes(
    `Si preguntan qué planes hay, nombra estos 8: ${EIGHT.join(", ")}.`
  )
);
assert.ok(prompt.includes("No resumas la lista y no omitas ninguno."));
for (const name of EIGHT) {
  assert.ok(prompt.includes(name), name);
}

const includesText = formatPlanIncludesForPrompt();

function lineFor(plan) {
  const line = includesText.split("\n").find((row) => row.startsWith(`- ${plan}:`));
  assert.ok(line, plan);
  return line;
}

function assertLabels(plan, labels) {
  const line = lineFor(plan);
  for (const label of labels) {
    assert.ok(line.includes(label), `${plan} ${label}`);
  }
  assert.ok(!/sauna/i.test(line), plan);
}

for (const plan of EIGHT) {
  assertLabels(plan, includesForPlan(plan));
}
assert.deepStrictEqual(
  [...includesForPlan("Plan Amarte")],
  [...includesForPlan("Plan Cabaña")]
);
assert.deepStrictEqual(
  [...includesForPlan("Plan Amarte")],
  [...includesForPlan("Plan Movimiento")]
);
assert.ok(lineFor("Plan Amarte").includes("Columpio"));
assert.ok(lineFor("Plan Amarte").includes("Vino espumoso"));
assert.ok(!lineFor("Plan Amarte").includes("Champaña"));
assert.ok(lineFor("Plan Húmedo").includes("Jacuzzi"));
assert.ok(!lineFor("Plan Húmedo").includes("Columpio"));
assert.ok(lineFor("Plan Cumpleaños").includes("Jacuzzi"));
assert.ok(lineFor("Plan Cumpleaños").includes("Velas"));
assert.ok(!lineFor("Plan Cumpleaños").includes("Cintas"));
assert.ok(lineFor("Plan Romántico").includes("Jacuzzi"));
assert.ok(!/sauna/i.test(lineFor("Plan Romántico")));
const erotico = lineFor("Plan Erótico");
assert.ok(erotico.includes("Antifaz"));
assert.ok(erotico.includes("Body"));
assert.ok(!erotico.includes("Body en malla"));
assert.ok(erotico.includes("Esposas"));
assert.ok(erotico.includes("Látigo"));
assert.deepStrictEqual(
  [...includesForPlan("Plan Cama Movimiento")],
  ["Pétalos de rosas", "Globos", "Champaña", "Chocolates (2)", "Crispetas (80gr)"]
);
assert.ok(!lineFor("Plan Movimiento").includes("Champaña"));
assert.ok(!lineFor("Plan Movimiento").toLowerCase().includes("confirma"));
assert.ok(!/\$\s*\d/.test(includesText));

const saunaText = formatSaunaMentionForPrompt();
assert.ok(prompt.includes(saunaText));
for (const suite of SAUNA_MENTION_SUITES) {
  assert.ok(saunaText.includes(suite), suite);
}
assert.deepStrictEqual([...SAUNA_MENTION_SUITES], [
  "Suite Gold",
  "Suite Gótica",
  "Suite Zafiro",
]);
assert.ok(!saunaText.includes("Suite Rubí"));
assert.ok(!saunaText.includes("Suite Jacuzzi"));
assert.ok(!/sauna/i.test(includesText));

const decoration = formatDecorationPolicyForPrompt();
assert.ok(prompt.includes(decoration));
assert.ok(
  decoration.includes(
    "Si piden decoración, ofrece primero el plan de esa suite."
  )
);
assert.ok(
  decoration.includes(
    "Si no quiere plan, cotiza la decoración suelta con la fila de Extras (room_extras)"
  )
);
assert.ok(decoration.includes("Suite Jacuzzi (Suite VIP Jacuzzi): Plan Húmedo."));
assert.ok(decoration.includes("- Suite Cabaña: Plan Cabaña."));
assert.ok(
  decoration.includes("Suite Movimiento (Suite Cama con Movimiento): Plan Movimiento.")
);
assert.ok(decoration.includes("No ofrezcas Plan Cama Movimiento como esa decoración."));
assert.ok(decoration.includes("- Suite Amarte: Plan Amarte."));

const choiceLine = decoration
  .split("\n")
  .find((row) => row.includes("Suite Queen") && row.includes("Suite Gold"));
assert.ok(choiceLine);
for (const suite of PLAN_CHOICE_GROUP.suites) {
  assert.ok(choiceLine.includes(suite), suite);
}
for (const plan of PLAN_CHOICE_GROUP.plans) {
  assert.ok(choiceLine.includes(plan), plan);
}
assert.ok(!choiceLine.includes("Suite Zafiro"));
assert.ok(!choiceLine.includes("Suite Jacuzzi"));
assert.ok(!/\$\s*\d/.test(decoration));
assert.ok(!decoration.includes("100.000"));
assert.ok(!decoration.includes("120.000"));

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
]);

function rate(name, kind, prices) {
  return [
    name,
    {
      name,
      kind,
      weekday: prices,
      weekend: {},
    },
  ];
}

(async () => {
  resetRoomRatesCache();
  setRoomRatesCacheForTests(
    new Map([
      rate("Suite Cabaña", "suite", { h4: 90000 }),
      rate("Suite Amarte", "suite", { h4: 80000 }),
      rate("Suite Movimiento", "suite", { h4: 85000 }),
      rate("Suite Jacuzzi", "suite", { h4: 240000 }),
      rate("Suite Queen", "suite", { h4: 260000 }),
      rate("Suite Gold", "suite", { h4: 270000 }),
      rate("Plan Húmedo", "plan", { h6: 210000 }),
      rate("Plan Cabaña", "plan", { h6: 190000 }),
    ])
  );
  setRoomExtrasCacheForTests(seeded);

  const looseCabana = await lookupCatalogPrice({
    suite: "Suite Cabaña",
    date: "2026-10-21",
    duration: "4 horas",
  });
  assert.strictEqual(looseCabana.decorationIncluded, false);
  assert.ok(
    looseCabana.extras.some(
      (row) => row.code === "decoracion_sencillas_cabana" && row.precio === 100000
    )
  );

  for (const suite of ["Suite Amarte", "Suite Movimiento"]) {
    const quote = await lookupCatalogPrice({
      suite,
      date: "2026-10-21",
      duration: "4 horas",
    });
    assert.strictEqual(quote.decorationIncluded, false);
    assert.ok(
      quote.extras.some(
        (row) => row.code === "decoracion_sencillas_cabana" && row.precio === 100000
      ),
      suite
    );
  }

  for (const suite of ["Suite Jacuzzi", "Suite Queen", "Suite Gold"]) {
    const quote = await lookupCatalogPrice({
      suite,
      date: "2026-10-21",
      duration: "4 horas",
    });
    assert.strictEqual(quote.decorationIncluded, false);
    assert.ok(
      quote.extras.some(
        (row) =>
          row.code === "decoracion_vip_tematicas_jacuzzi_sauna" &&
          row.precio === 120000
      ),
      suite
    );
    assert.ok(
      !quote.extras.some((row) => row.code === "decoracion_sencillas_cabana"),
      suite
    );
  }

  for (const plan of ["Plan Húmedo", "Plan Cabaña"]) {
    const quote = await lookupCatalogPrice({
      suite: plan,
      date: "2026-10-21",
      duration: "6 horas",
    });
    assert.strictEqual(quote.decorationIncluded, true);
    assert.ok(quote.priceCop > 0);
    assert.ok(
      !quote.extras.some((row) => String(row.code).startsWith("decoracion_")),
      plan
    );
  }

  const site = await beginPriceTurn("");
  const looseReply = "Sin plan, la decoración de la Cabaña vale $100.000.";
  for (const message of [
    "no quiero plan, solo la decoración",
    "no quiero ningún plan, cotiza la decoración",
    "cuánto vale la decoración sin el plan",
    "no quiero ese plan, quiero la decoración",
    "sin el plan, cuánto es la decoración",
    "no me interesa el plan, cotiza la decoración",
    "puedo la decoración aparte del plan",
    "quiero decorar la cabaña, sin plan",
    "la decoración, no el plan",
  ]) {
    const loosePath = finishLandingReply(site, looseReply, message);
    assert.ok(loosePath.includes("100.000"), message);
    assert.ok(!loosePath.includes("tarifa no disponible"), message);
  }
  const planReply = "El Plan Húmedo lleva decoración de $120.000.";
  for (const message of [
    "cuánto vale el plan húmedo",
    "no quiero el plan erótico, quiero el plan romántico",
    "no quiero el plan erótico, quiero el plan romántico con decoración",
    "solo la decoración del plan húmedo",
    "no quiero planificar la decoración, explícame el plan erótico",
  ]) {
    const planPath = finishLandingReply(site, planReply, message);
    assert.ok(!planPath.includes("120"), message);
  }

  setRoomRatesCacheForTests(
    new Map([
      rate("Suite Amarte", "suite", { h4: 120000 }),
      rate("Plan Húmedo", "plan", { h6: 210000 }),
    ])
  );
  const collided = await beginPriceTurn("");
  const mixed = finishLandingReply(
    collided,
    "El Plan Húmedo lleva decoración de $120.000.\nSuite Amarte 4 h: $120.000.",
    "cuánto vale el plan húmedo"
  );
  const [decoLine, suiteLine] = mixed.split("\n");
  assert.ok(!decoLine.includes("120"));
  assert.ok(suiteLine.includes("120.000"));

  resetRoomRatesCache();
  console.log("planPrompt.test.js: ok");
})().catch((err) => {
  console.error(err);
  resetRoomRatesCache();
  process.exit(1);
});
