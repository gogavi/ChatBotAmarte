/**
 * Sin landingAddendum el prompt queda byte a byte como el de amartesuite.com.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { buildMartinaSystemPrompt } = require("../config/martinaSystemPrompt");

const context = {
  roomName: "Amarte Suite",
  pageUrl: "https://amartesuite.com/",
  referenceDate: "2026-10-21",
  referenceTime: "10:30",
  referenceWeekday: "miércoles",
  referenceIso: "2026-10-21T15:30:00.000Z",
  detectedSuiteLabel: null,
  detectedSuiteUrl: null,
};

const fixture = fs.readFileSync(
  path.join(__dirname, "fixtures/martina-system-prompt.snapshot.txt"),
  "utf8"
);

assert.strictEqual(buildMartinaSystemPrompt(context), fixture);
assert.strictEqual(
  buildMartinaSystemPrompt({ ...context, landingAddendum: null }),
  fixture
);
assert.strictEqual(
  buildMartinaSystemPrompt({ ...context, landingAddendum: undefined }),
  fixture
);
assert.strictEqual(
  buildMartinaSystemPrompt({ ...context, landingAddendum: "" }),
  fixture
);

const withLanding = buildMartinaSystemPrompt({
  ...context,
  landingAddendum: "BLOQUE-LANDING-PRUEBA",
});
assert.strictEqual(withLanding, `${fixture}\n\nBLOQUE-LANDING-PRUEBA`);
assert.ok(!fixture.includes("BLOQUE-LANDING-PRUEBA"));
assert.ok(!fixture.includes("formatPricingForPrompt"));
for (const amount of ["$60.000", "$150.000", "$100.000", "$120.000", "$30.000", "$78.000", "$175.000"]) {
  assert.ok(!fixture.includes(amount), amount);
}

console.log("martinaPromptSnapshot.test.js ok");
