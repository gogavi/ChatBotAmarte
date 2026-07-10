const assert = require("assert");
const {
  sanitizeConversationId,
  validatePageUrl,
  sanitizeRoomName,
} = require("../services/liveVoiceValidation");

const goodId = "550e8400-e29b-41d4-a716-446655440000";
assert.strictEqual(sanitizeConversationId(goodId), goodId);
assert.strictEqual(sanitizeConversationId("not-a-uuid"), null);

const ok = validatePageUrl(
  "https://amartesuite.com/producto/suite-vip-jacuzzi/"
);
assert.strictEqual(ok.ok, true);
assert.strictEqual(ok.pagePath, "/producto/suite-vip-jacuzzi/");

const bad = validatePageUrl("https://evil.example.com/hack");
assert.strictEqual(bad.ok, false);

const noUrl = validatePageUrl("");
assert.strictEqual(noUrl.ok, false);

assert.strictEqual(sanitizeRoomName("x".repeat(600)).length, 500);

console.log("liveVoiceValidation tests passed");
