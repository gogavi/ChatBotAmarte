const assert = require("assert");
const { normalizeTextForTts } = require("../ttsNormalize");

assert.strictEqual(normalizeTextForTts("Pack de 4 h"), "Pack de 4 horas");
assert.strictEqual(normalizeTextForTts("Pack de 4h"), "Pack de 4 horas");
assert.strictEqual(normalizeTextForTts("1 h disponible"), "1 hora disponible");
assert.strictEqual(normalizeTextForTts("8 hrs"), "8 horas");

assert.strictEqual(
  normalizeTextForTts("Desde $90.000"),
  "Desde 90.000 pesos"
);
assert.strictEqual(
  normalizeTextForTts("Total $160.000 COP"),
  "Total 160.000 pesos"
);
assert.strictEqual(
  normalizeTextForTts("Abono $90000"),
  "Abono 90.000 pesos"
);

assert.strictEqual(
  normalizeTextForTts(
    "Suite Amarte · 8 h · viernes–sábado: $160.000"
  ),
  "Suite Amarte, 8 horas, viernes, sábado: 160.000 pesos"
);

assert.ok(
  normalizeTextForTts(
    "Mira https://amartesuite.com/producto/suite-amarte/ por favor"
  ).includes("enlace en el chat")
);
assert.ok(
  !normalizeTextForTts(
    "Mira https://amartesuite.com/producto/suite-amarte/ por favor"
  ).includes("https://")
);

assert.strictEqual(normalizeTextForTts(""), "");
assert.strictEqual(normalizeTextForTts(null), "");

console.log("ttsNormalize tests passed");
