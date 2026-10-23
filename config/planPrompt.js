/**
 * Texto de planes para el prompt de Martina.
 * Los nombres salen de PLAN_SUITE_RULES. Lo que incluye cada plan sale de
 * pricing.plans, partido por plan. Si el catálogo no tiene el plan, se pide
 * confirmar con un asesor.
 */

const { pricing } = require("./amarteCatalog");
const { PLAN_SUITE_RULES, PLAN_CHOICE_GROUP } = require("./planSuites");

const CONFIRM_INCLUDES =
  "Confirma con un asesor qué incluye este plan. No lo inventes ni copies el contenido de otro plan.";

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

/**
 * "Plan Romántico / Cumpleaños / Erótico" y
 * "Plan Cabaña o Plan Cama Movimiento" nombran varios planes en una fila.
 * @param {string} name
 * @returns {string[]}
 */
function splitCatalogPlanName(name) {
  const raw = String(name || "");
  const parts = raw.includes(" / ")
    ? raw.split(" / ")
    : raw.includes(" o ")
      ? raw.split(" o ")
      : [raw];
  return parts.map((part) => {
    const trimmed = part.trim();
    if (trimmed.startsWith("Plan ")) return trimmed;
    return `Plan ${trimmed}`;
  });
}

/**
 * @param {string} plan
 * @returns {{ name: string; includes?: { emoji: string; label: string }[]; includesErotico?: { emoji: string; label: string }[] } | null}
 */
function catalogEntryForPlan(plan) {
  const hits = [];
  for (const entry of Object.values(pricing.plans)) {
    if (splitCatalogPlanName(entry.name).includes(plan)) hits.push(entry);
  }
  if (hits.length > 1) {
    throw new Error(`plan en más de una fila del catálogo: ${plan}`);
  }
  return hits[0] || null;
}

/**
 * @param {{ emoji: string; label: string }} item
 * @returns {string}
 */
function formatIncludeItem(item) {
  return `${item.emoji} ${item.label}`;
}

/**
 * Una viñeta del grupo puede nombrar un solo plan, p.ej. "(Plan Romántico)".
 * @param {string} label
 * @param {string} plan
 * @returns {boolean}
 */
function scopedToOtherPlan(label, plan) {
  const match = String(label).match(/\(Plan ([^)]+)\)/);
  if (!match) return false;
  return `Plan ${match[1]}` !== plan;
}

/**
 * @param {string} plan
 * @returns {string[] | null} null si el catálogo no tiene ese plan.
 */
function includesForPlan(plan) {
  const entry = catalogEntryForPlan(plan);
  if (!entry) return null;
  const lines = [];
  const shared = Array.isArray(entry.includes) ? entry.includes : [];
  for (const item of shared) {
    if (scopedToOtherPlan(item.label, plan)) continue;
    lines.push(formatIncludeItem(item));
  }
  if (plan === "Plan Erótico" && Array.isArray(entry.includesErotico)) {
    for (const item of entry.includesErotico) {
      const line = formatIncludeItem(item);
      if (!lines.includes(line)) lines.push(line);
    }
  }
  if (lines.length === 0) {
    throw new Error(`el catálogo no dejó includes para ${plan}`);
  }
  return lines;
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
    const items = includesForPlan(plan);
    if (!items) {
      lines.push(`- ${plan}: ${CONFIRM_INCLUDES}`);
      continue;
    }
    lines.push(`- ${plan}: ${items.join("; ")}.`);
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
  CONFIRM_INCLUDES,
};
