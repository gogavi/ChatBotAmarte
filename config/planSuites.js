/**
 * Suites que corresponden a cada plan.
 * Los montos no viven aquí: salen de room_rates.
 *
 * @typedef {"only"|"recommend"} PlanSuiteMode
 * @typedef {{
 *   plan: string;
 *   mode: PlanSuiteMode;
 *   suites: readonly string[];
 *   exclude: readonly string[];
 *   suppressPhrases: readonly string[];
 * }} PlanSuiteRule
 */

/** @type {readonly PlanSuiteRule[]} */
const PLAN_SUITE_RULES = Object.freeze([
  Object.freeze({
    plan: "Plan Húmedo",
    mode: "only",
    suites: Object.freeze(["Suite Jacuzzi"]),
    exclude: Object.freeze([]),
    suppressPhrases: Object.freeze(["sauna"]),
  }),
  Object.freeze({
    plan: "Plan Cumpleaños",
    mode: "recommend",
    suites: Object.freeze([
      "Suite Queen",
      "Suite Gótica",
      "Suite Árabe",
      "Suite Diamante",
    ]),
    exclude: Object.freeze([]),
    suppressPhrases: Object.freeze([]),
  }),
  Object.freeze({
    plan: "Plan Romántico",
    mode: "recommend",
    suites: Object.freeze(["Suite Rubí", "Suite Gold", "Suite Diamante"]),
    exclude: Object.freeze(["Suite Gótica"]),
    suppressPhrases: Object.freeze([]),
  }),
  Object.freeze({
    plan: "Plan Cabaña",
    mode: "only",
    suites: Object.freeze(["Suite Cabaña"]),
    exclude: Object.freeze([]),
    suppressPhrases: Object.freeze([]),
  }),
  Object.freeze({
    plan: "Plan Movimiento",
    mode: "only",
    suites: Object.freeze(["Suite Movimiento"]),
    exclude: Object.freeze([]),
    suppressPhrases: Object.freeze([]),
  }),
  Object.freeze({
    plan: "Plan Amarte",
    mode: "only",
    suites: Object.freeze(["Suite Amarte"]),
    exclude: Object.freeze([]),
    suppressPhrases: Object.freeze([]),
  }),
  Object.freeze({
    plan: "Plan Erótico",
    mode: "recommend",
    suites: Object.freeze(["Suite Queen", "Suite Gótica", "Suite Diamante"]),
    exclude: Object.freeze([]),
    suppressPhrases: Object.freeze([]),
  }),
  Object.freeze({
    plan: "Plan Cama Movimiento",
    mode: "only",
    suites: Object.freeze(["Suite Movimiento"]),
    exclude: Object.freeze([]),
    suppressPhrases: Object.freeze([]),
  }),
]);

/**
 * @param {unknown} plan
 * @returns {PlanSuiteRule | null}
 */
function ruleForPlan(plan) {
  if (typeof plan !== "string") return null;
  return PLAN_SUITE_RULES.find((rule) => rule.plan === plan) || null;
}

/**
 * @param {PlanSuiteRule} rule
 * @returns {string}
 */
function formatPlanSuiteRule(rule) {
  const names = rule.suites.join(", ");
  switch (rule.mode) {
    case "only":
      return `- ${rule.plan}: solo ${names}. No lo ofrezcas en otra suite.`;
    case "recommend": {
      const ban = rule.exclude.length
        ? ` No recomiendes ${rule.exclude.join(", ")}.`
        : "";
      return `- ${rule.plan}: se recomiendan ${names}.${ban}`;
    }
    default: {
      const unknown = rule.mode;
      throw new Error(`modo de plan no reconocido: ${unknown}`);
    }
  }
}

function formatPlanSuiteRulesForPrompt() {
  const lines = [
    "## Suites por plan",
    "Recomienda estas suites. El precio de cada una sale de room_rates. Si no hay fila, no des un monto.",
  ];
  for (const rule of PLAN_SUITE_RULES) {
    lines.push(formatPlanSuiteRule(rule));
  }
  return lines.join("\n");
}

module.exports = {
  PLAN_SUITE_RULES,
  ruleForPlan,
  formatPlanSuiteRule,
  formatPlanSuiteRulesForPrompt,
};
