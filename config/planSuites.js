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

/**
 * Guillermo confirmó el grupo el 21-oct-2026 y metió Suite Gold.
 *
 * Leído ese día en room_rates de dftbelnombbtjryqphaa, solo SELECT.
 * Queen, Gótica, Rubí, Diamante, Árabe y Gold tienen la misma grilla de suite.
 * Cada plan tiene una sola tarifa, sin columna por suite, y las tres tarifas
 * positivas coinciden. Por eso samePrice es true y el prompt no escribe montos.
 * room_extras no existe en esa base: no afirmar decoración de 120000.
 * Suite Gamer no entra.
 *
 * @typedef {{
 *   pendingConfirmation: false;
 *   samePrice: true;
 *   plans: readonly string[];
 *   suites: readonly string[];
 * }} PlanChoiceGroup
 */

/** @type {PlanChoiceGroup} */
const PLAN_CHOICE_GROUP = Object.freeze({
  pendingConfirmation: false,
  samePrice: true,
  plans: Object.freeze(["Plan Cumpleaños", "Plan Romántico", "Plan Erótico"]),
  suites: Object.freeze([
    "Suite Queen",
    "Suite Gótica",
    "Suite Rubí",
    "Suite Diamante",
    "Suite Árabe",
    "Suite Gold",
  ]),
});

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
      "Suite Zafiro",
    ]),
    exclude: Object.freeze([]),
    suppressPhrases: Object.freeze([]),
  }),
  Object.freeze({
    plan: "Plan Romántico",
    mode: "recommend",
    suites: Object.freeze([
      "Suite Rubí",
      "Suite Gold",
      "Suite Diamante",
      "Suite Zafiro",
    ]),
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

function formatPlanChoiceForPrompt() {
  const plans = PLAN_CHOICE_GROUP.plans.join(", ");
  const names = PLAN_CHOICE_GROUP.suites.join(", ");
  return [
    "## Elección",
    `${plans} se pueden tomar en ${names}.`,
    "Si el cliente elige una de esas suites, dile que puede escogerla, aunque no esté en la lista recomendada.",
    "No sustituyas esa suite por otra y no añadas otra landing solo por esa elección.",
    "El precio es el del plan en room_rates y es el mismo en cualquiera de esas seis.",
    "Suite Gamer no entra en ese grupo.",
    "No inventes un monto de decoración.",
  ].join("\n");
}

/**
 * @param {unknown} plan
 * @returns {{ pendingConfirmation: false; samePrice: true; suites: string[] } | null}
 */
function choiceForPlan(plan) {
  if (typeof plan !== "string" || !PLAN_CHOICE_GROUP.plans.includes(plan)) return null;
  return {
    pendingConfirmation: false,
    samePrice: PLAN_CHOICE_GROUP.samePrice,
    suites: [...PLAN_CHOICE_GROUP.suites],
  };
}

function formatPlanSuiteRulesForPrompt() {
  const lines = [
    "## Suites por plan",
    "Recomienda estas suites. El precio de cada una sale de room_rates. Si no hay fila, no des un monto.",
  ];
  for (const rule of PLAN_SUITE_RULES) {
    lines.push(formatPlanSuiteRule(rule));
  }
  return `${lines.join("\n")}\n\n${formatPlanChoiceForPrompt()}`;
}

module.exports = {
  PLAN_SUITE_RULES,
  PLAN_CHOICE_GROUP,
  ruleForPlan,
  choiceForPlan,
  formatPlanSuiteRule,
  formatPlanSuiteRulesForPrompt,
};
