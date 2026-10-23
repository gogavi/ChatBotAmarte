/**
 * Texto de planes para el prompt de Martina.
 * Los nombres salen de PLAN_SUITE_RULES. Lo que incluye cada plan sale de
 * config/planCatalog.js, una fila por plan.
 */

const { PLAN_SUITE_RULES, PLAN_CHOICE_GROUP } = require("./planSuites");
const { includesForPlan } = require("./planCatalog");

/**
 * @param {string} plan
 * @returns {string}
 */
function withoutPlanPrefix(plan) {
  return String(plan).replace(/^Plan\s+/, "");
}

/**
 * Los 8 planes, en orden alfabético del nombre sin el prefijo.
 * @returns {string[]}
 */
function canonicalPlanNames() {
  const names = [...new Set(PLAN_SUITE_RULES.map((rule) => rule.plan))];
  names.sort((a, b) =>
    withoutPlanPrefix(a).localeCompare(withoutPlanPrefix(b), "es")
  );
  return names;
}

function formatCanonicalPlansForPrompt() {
  const plans = canonicalPlanNames();
  return [
    `Si preguntan qué planes hay, nombra estos ${plans.length}: ${plans.join(", ")}.`,
    "No resumas la lista y no omitas ninguno. Esta lista completa es obligatoria aunque el mensaje deba ser corto.",
  ].join("\n");
}

function formatPlanIncludesForPrompt() {
  const lines = ["## Qué incluye cada plan"];
  for (const plan of canonicalPlanNames()) {
    lines.push(`- ${plan}: ${includesForPlan(plan).join("; ")}.`);
  }
  return lines.join("\n");
}

/**
 * @param {string} suite
 * @returns {string}
 */
function suiteNameTail(suite) {
  return String(suite).replace(/^Suite\s+/, "");
}

/**
 * Plan que se ofrece al pedir decoración.
 * El grupo de elección ofrece sus tres planes.
 * Una suite exclusiva usa su plan `only`.
 * Si varios planes `only` comparten suite, queda el que se llama como la suite
 * (Suite Movimiento → Plan Movimiento, no Plan Cama Movimiento).
 * @returns {Array<{ suites: string[]; plans: string[] }>}
 */
function exclusivePlansBySuite() {
  const choiceSuites = new Set(PLAN_CHOICE_GROUP.suites);
  /** @type {Map<string, string[]>} */
  const onlyBySuite = new Map();
  for (const rule of PLAN_SUITE_RULES) {
    if (rule.mode !== "only") continue;
    for (const suite of rule.suites) {
      if (choiceSuites.has(suite)) continue;
      const list = onlyBySuite.get(suite) || [];
      list.push(rule.plan);
      onlyBySuite.set(suite, list);
    }
  }
  return onlyBySuite;
}

function decorationOffers() {
  /** @type {Array<{ suites: string[]; plans: string[]; dropped: string[] }>} */
  const offers = [];
  for (const [suite, plans] of exclusivePlansBySuite()) {
    const exact = `Plan ${suiteNameTail(suite)}`;
    const picked = plans.includes(exact) ? [exact] : [...plans];
    const dropped = plans.filter((plan) => !picked.includes(plan));
    offers.push({ suites: [suite], plans: picked, dropped });
  }
  offers.push({
    suites: [...PLAN_CHOICE_GROUP.suites],
    plans: [...PLAN_CHOICE_GROUP.plans],
    dropped: [],
  });
  return offers;
}

/**
 * @param {string[]} plans
 * @returns {string}
 */
function joinPlans(plans) {
  if (plans.length === 1) return plans[0];
  if (plans.length === 2) return `${plans[0]} o ${plans[1]}`;
  return `${plans.slice(0, -1).join(", ")} o ${plans[plans.length - 1]}`;
}

/**
 * Nombres de ficha que no coinciden con el room type.
 * @param {string} suite
 * @returns {string}
 */
function suitePromptName(suite) {
  if (suite === "Suite Jacuzzi") return "Suite Jacuzzi (Suite VIP Jacuzzi)";
  if (suite === "Suite Movimiento") {
    return "Suite Movimiento (Suite Cama con Movimiento)";
  }
  return suite;
}

function formatDecorationPolicyForPrompt() {
  const lines = [
    "## Decoración",
    "Si piden decoración, ofrece primero el plan de esa suite. El plan ya trae la decoración: no sumes el extra.",
    "Si no quiere plan, cotiza la decoración suelta con la fila de Extras (room_extras) que aplique a esa suite. Si esa fila no está, no inventes el monto.",
    "Suite VIP Jacuzzi es Suite Jacuzzi. Suite Cama con Movimiento es Suite Movimiento.",
    "Si no reconoces la suite, no inventes un plan y usa solo esa fila de room_extras.",
  ];
  for (const offer of decorationOffers()) {
    const suites = offer.suites.map(suitePromptName).join(", ");
    lines.push(`- ${suites}: ${joinPlans(offer.plans)}.`);
    if (offer.dropped.length) {
      lines.push(
        `En ${suites} la decoración es ${joinPlans(offer.plans)}. No ofrezcas ${offer.dropped.join(" ni ")} como esa decoración.`
      );
    }
  }
  return lines.join("\n");
}

function formatPlansForPrompt() {
  return [
    formatCanonicalPlansForPrompt(),
    "Al ofrecer un **plan**, indica qué incluye, con las viñetas de esta sección, y los precios por duración del plan (6 h / 12 h / día hotelero según catálogo). No uses el montaje de referencia ni la lista de otro plan. La decoración ya viene incluida en el plan. No la cobres como extra y no inventes ese monto. No inventes extras.",
    "",
    formatPlanIncludesForPrompt(),
    "",
    formatDecorationPolicyForPrompt(),
  ].join("\n");
}

module.exports = {
  canonicalPlanNames,
  includesForPlan,
  decorationOffers,
  formatCanonicalPlansForPrompt,
  formatPlanIncludesForPrompt,
  formatDecorationPolicyForPrompt,
  formatPlansForPrompt,
};
