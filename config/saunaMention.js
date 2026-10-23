/**
 * Sauna ilimitado por suite, no por plan.
 * No es la landing suite-sauna-jacuzzi (esa incluye Suite Rubí).
 */

const SAUNA_MENTION_SUITES = Object.freeze([
  "Suite Gold",
  "Suite Gótica",
  "Suite Zafiro",
]);

/**
 * @param {unknown} suite
 * @returns {boolean}
 */
function saunaMentionApplies(suite) {
  return typeof suite === "string" && SAUNA_MENTION_SUITES.includes(suite);
}

function formatSaunaMentionForPrompt() {
  return [
    "## Sauna ilimitado",
    "El sauna ilimitado es de la suite, no de un plan.",
    `Menciónalo solo cuando la suite de la que hablas es ${SAUNA_MENTION_SUITES.join(", ")}.`,
    "Si la suite no está en esa lista, no hables de sauna.",
  ].join("\n");
}

module.exports = {
  SAUNA_MENTION_SUITES,
  saunaMentionApplies,
  formatSaunaMentionForPrompt,
};
