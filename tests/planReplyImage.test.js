/**
 * El póster sale del texto de la respuesta. Un plan con imagen, o ninguno.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { canonicalPlanNames } = require("../config/planPrompt");
const {
  includesForPlan,
  plansNamedInReply,
  planImageForReply,
} = require("../config/planCatalog");
const {
  saunaMentionApplies,
  SAUNA_MENTION_SUITES,
} = require("../config/saunaMention");

assert.strictEqual(plansNamedInReply("El Plan Cama Movimiento trae crispetas"), null);
assert.strictEqual(
  plansNamedInReply("El Plan Movimiento trae columpio"),
  "Plan Movimiento"
);
assert.strictEqual(
  plansNamedInReply("Plan Cama Movimiento no es Plan Movimiento"),
  null
);
assert.strictEqual(
  plansNamedInReply("movimiento de la cama"),
  null
);

const romantico = planImageForReply("Te presento el Plan Romántico");
assert.deepStrictEqual(romantico, {
  plan: "Plan Romántico",
  src: "/plans/plan-romantico.webp",
  alt: "Plan Romántico",
});
assert.deepStrictEqual(
  planImageForReply("El Plan Romántico y las velas"),
  romantico
);
assert.strictEqual(
  planImageForReply("Plan Romántico y Plan Erótico"),
  null
);
assert.strictEqual(
  planImageForReply("Plan Romántico / Cumpleaños / Erótico"),
  null
);
assert.strictEqual(
  planImageForReply("Plan Romántico, Cumpleaños y Erótico"),
  null
);
assert.strictEqual(
  planImageForReply("Plan Cabaña o Cama Movimiento"),
  null
);
assert.strictEqual(
  planImageForReply("Plan Cabaña o Plan Cama Movimiento"),
  null
);
assert.deepStrictEqual(
  planImageForReply("El Plan Romántico no es el Plan Cama Movimiento"),
  null
);
assert.strictEqual(
  planImageForReply(canonicalPlanNames().join(", ")),
  null
);
assert.deepStrictEqual(
  planImageForReply("El Plan Movimiento y otra vez el Plan Movimiento"),
  {
    plan: "Plan Movimiento",
    src: "/plans/plan-movimiento.webp",
    alt: "Plan Movimiento",
  }
);

const plansDir = path.join(__dirname, "../public/plans");
for (const plan of canonicalPlanNames()) {
  const image = planImageForReply(plan);
  for (const label of includesForPlan(plan)) {
    assert.ok(!/sauna/i.test(label), `${plan} ${label}`);
  }
  if (plan === "Plan Cama Movimiento") {
    assert.strictEqual(image, null);
    assert.ok(!fs.existsSync(path.join(plansDir, "plan-cama-movimiento.webp")));
    continue;
  }
  assert.ok(image, plan);
  assert.ok(image.src.startsWith("/plans/"));
  assert.ok(image.src.endsWith(".webp"));
  const file = path.join(plansDir, path.basename(image.src));
  assert.ok(fs.existsSync(file), file);
  assert.ok(fs.statSync(file).size < 200 * 1024, file);
  assert.ok(fs.statSync(file).size > 0, file);
}

assert.ok(saunaMentionApplies("Suite Gold"));
assert.ok(saunaMentionApplies("Suite Gótica"));
assert.ok(saunaMentionApplies("Suite Zafiro"));
assert.ok(!saunaMentionApplies("Suite Rubí"));
assert.ok(!saunaMentionApplies("Suite Jacuzzi"));
assert.deepStrictEqual(
  [...SAUNA_MENTION_SUITES],
  ["Suite Gold", "Suite Gótica", "Suite Zafiro"]
);

console.log("planReplyImage.test.js ok");
