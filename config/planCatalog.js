/**
 * Una fila por plan. Las viñetas salen de los pósters.
 * Plan Cama Movimiento no tiene póster: conserva la lista anterior.
 * La ruta /plans/<slug>.webp nace solo en planImageForReply.
 */

const { PLAN_SUITE_RULES } = require("./planSuites");

/** Los tres pósters traen las mismas seis líneas, en el mismo orden. */
const AMARTE_SIX = Object.freeze([
  "Vino espumoso",
  "Columpio",
  "Pétalos",
  "Crispetas",
  "Globos",
  "Dos chocolates",
]);

/**
 * @typedef {"Plan Amarte"|"Plan Cabaña"|"Plan Cama Movimiento"|"Plan Cumpleaños"|"Plan Erótico"|"Plan Húmedo"|"Plan Movimiento"|"Plan Romántico"} PlanName
 * @typedef {{ plan: PlanName; includes: readonly string[]; posterSlug: string | null }} PlanRow
 * @typedef {{ plan: PlanName; src: string; alt: string }} PlanImage
 */

/** @type {readonly PlanRow[]} */
const PLAN_ROWS = Object.freeze([
  Object.freeze({ plan: "Plan Amarte", includes: AMARTE_SIX, posterSlug: "plan-amarte" }),
  Object.freeze({ plan: "Plan Cabaña", includes: AMARTE_SIX, posterSlug: "plan-cabana" }),
  Object.freeze({
    plan: "Plan Cama Movimiento",
    includes: Object.freeze([
      "Pétalos de rosas",
      "Globos",
      "Champaña",
      "Chocolates (2)",
      "Crispetas (80gr)",
    ]),
    posterSlug: null,
  }),
  Object.freeze({
    plan: "Plan Cumpleaños",
    includes: Object.freeze([
      "Jacuzzi",
      "Vino espumoso",
      "Globos",
      "Velas",
      "Pétalos",
      "Crispetas",
      "Dos chocolates",
    ]),
    posterSlug: "plan-cumpleanos",
  }),
  Object.freeze({
    plan: "Plan Erótico",
    includes: Object.freeze([
      "Antifaz",
      "Body",
      "Esposas",
      "Látigo",
      "Jacuzzi",
      "Vino espumoso",
      "Velas",
      "Pétalos",
      "Crispetas",
      "Globos",
      "Dos chocolates",
    ]),
    posterSlug: "plan-erotico",
  }),
  Object.freeze({
    plan: "Plan Húmedo",
    includes: Object.freeze([
      "Jacuzzi",
      "Vino espumoso",
      "Velas",
      "Pétalos",
      "Crispetas",
      "Globos",
      "Dos chocolates",
    ]),
    posterSlug: "plan-humedo",
  }),
  Object.freeze({ plan: "Plan Movimiento", includes: AMARTE_SIX, posterSlug: "plan-movimiento" }),
  Object.freeze({
    plan: "Plan Romántico",
    includes: Object.freeze([
      "Jacuzzi",
      "Vino espumoso",
      "Velas",
      "Pétalos",
      "Crispetas",
      "Globos",
      "Dos chocolates",
    ]),
    posterSlug: "plan-romantico",
  }),
]);

/**
 * @param {string} value
 * @returns {string}
 */
function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function assertCatalog() {
  const ruleNames = PLAN_SUITE_RULES.map((rule) => rule.plan);
  const rowNames = PLAN_ROWS.map((row) => row.plan);
  const ruleSet = [...ruleNames].sort().join("\n");
  const rowSet = [...rowNames].sort().join("\n");
  if (ruleSet !== rowSet || new Set(rowNames).size !== rowNames.length) {
    throw new Error("PLAN_ROWS no coincide con PLAN_SUITE_RULES");
  }
  const slugs = new Set();
  for (const row of PLAN_ROWS) {
    for (const label of row.includes) {
      if (/sauna/i.test(label) || /\(Plan /.test(label)) {
        throw new Error(`viñeta de plan no permitida en ${row.plan}: ${label}`);
      }
    }
    if (row.plan === "Plan Cama Movimiento") {
      if (row.posterSlug != null) {
        throw new Error("Plan Cama Movimiento no tiene póster");
      }
      continue;
    }
    if (!row.posterSlug || slugs.has(row.posterSlug)) {
      throw new Error(`slug de póster inválido: ${row.plan}`);
    }
    slugs.add(row.posterSlug);
  }
}

/** @type {readonly { plan: PlanName; phrase: string }[]} */
const NAME_INDEX = Object.freeze(
  [...PLAN_ROWS]
    .map((row) => ({ plan: row.plan, phrase: fold(row.plan) }))
    .sort((a, b) => b.phrase.length - a.phrase.length)
);

/** Cola sin «Plan », la más larga primero. «cama movimiento» gana a «movimiento». */
const PLAN_TAILS = Object.freeze(
  [...PLAN_ROWS]
    .map((row) => ({
      plan: row.plan,
      phrase: fold(row.plan).replace(/^plan /, ""),
    }))
    .sort((a, b) => b.phrase.length - a.phrase.length)
);

/**
 * @param {string} folded
 * @param {number} end
 * @param {PlanName[]} hits
 */
function absorbBareContinuations(folded, end, hits) {
  let cursor = end;
  while (cursor < folded.length) {
    const sep = folded.slice(cursor).match(/^(?:\s*(?:\/|,|y|o)\s+)/);
    if (!sep) break;
    const after = cursor + sep[0].length;
    let matched = null;
    for (const tail of PLAN_TAILS) {
      if (!folded.startsWith(tail.phrase, after)) continue;
      const tailEnd = after + tail.phrase.length;
      const next = tailEnd >= folded.length ? "" : folded[tailEnd];
      if (next && /\p{L}/u.test(next)) continue;
      matched = { plan: tail.plan, end: tailEnd };
      break;
    }
    if (!matched) break;
    hits.push(matched.plan);
    cursor = matched.end;
  }
}

/**
 * @param {string} plan
 * @returns {PlanRow}
 */
function rowForPlan(plan) {
  const row = PLAN_ROWS.find((item) => item.plan === plan);
  if (!row) throw new Error(`plan fuera del catálogo: ${plan}`);
  return row;
}

/**
 * @param {string} plan
 * @returns {readonly string[]}
 */
function includesForPlan(plan) {
  return rowForPlan(plan).includes;
}

/**
 * Un solo plan con póster nombrado en el texto, o null.
 * «Plan Cama Movimiento» ocupa su propio tramo y no es «Plan Movimiento».
 * @param {string} text
 * @returns {PlanName | null}
 */
function plansNamedInReply(text) {
  const folded = fold(text);
  /** @type {{ start: number; end: number }[]} */
  const claimed = [];
  /** @type {PlanName[]} */
  const hits = [];
  for (const entry of NAME_INDEX) {
    let from = 0;
    while (from < folded.length) {
      const start = folded.indexOf(entry.phrase, from);
      if (start < 0) break;
      const end = start + entry.phrase.length;
      const before = start === 0 ? "" : folded[start - 1];
      const after = end >= folded.length ? "" : folded[end];
      const letter = (ch) => Boolean(ch) && /\p{L}/u.test(ch);
      const overlaps = claimed.some((span) => start < span.end && end > span.start);
      if (!letter(before) && !letter(after) && !overlaps) {
        claimed.push({ start, end });
        hits.push(entry.plan);
        absorbBareContinuations(folded, end, hits);
      }
      from = end;
    }
  }
  /** @type {PlanName[]} */
  const unique = [];
  for (const plan of hits) {
    if (!unique.includes(plan)) unique.push(plan);
  }
  if (unique.length !== 1) return null;
  const row = rowForPlan(unique[0]);
  if (!row.posterSlug) return null;
  return row.plan;
}

/**
 * Único constructor de la ruta del póster.
 * @param {string} text
 * @returns {PlanImage | null}
 */
function planImageForReply(text) {
  const plan = plansNamedInReply(text);
  if (!plan) return null;
  const row = rowForPlan(plan);
  return {
    plan,
    src: `/plans/${row.posterSlug}.webp`,
    alt: plan,
  };
}

assertCatalog();

module.exports = {
  includesForPlan,
  plansNamedInReply,
  planImageForReply,
};
