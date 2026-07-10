const assert = require("assert");
const {
  CHAT_ACTIONS,
  DEFAULT_ACTION_TYPES,
  resolveChatActions,
  stripOptionsBlock,
  tryParseStructuredMartinaReply,
  buildAssistantResponse,
} = require("../config/chatActions");

assert.deepStrictEqual(
  resolveChatActions(["wompi", "whatsapp"]),
  [
    { label: CHAT_ACTIONS.wompi.label, url: CHAT_ACTIONS.wompi.url },
    { label: CHAT_ACTIONS.whatsapp.label, url: CHAT_ACTIONS.whatsapp.url },
  ]
);

assert.deepStrictEqual(
  resolveChatActions([]),
  DEFAULT_ACTION_TYPES.map((t) => ({
    label: CHAT_ACTIONS[t].label,
    url: CHAT_ACTIONS[t].url,
  }))
);

assert.deepStrictEqual(
  resolveChatActions(["wompi", "fake", "wompi", "reserve"]),
  [
    { label: CHAT_ACTIONS.wompi.label, url: CHAT_ACTIONS.wompi.url },
    { label: CHAT_ACTIONS.reserve.label, url: CHAT_ACTIONS.reserve.url },
  ]
);

assert.strictEqual(
  stripOptionsBlock("Hola\n[OPTIONS]\n[]\n[/OPTIONS]"),
  "Hola"
);

const structured = tryParseStructuredMartinaReply(
  JSON.stringify({
    message: "La Suite VIP Jacuzzi está disponible.",
    actionTypes: ["reserve", "wompi"],
    pendingReservation: null,
  })
);
assert.ok(structured);
assert.strictEqual(structured.message, "La Suite VIP Jacuzzi está disponible.");
assert.strictEqual(structured.pendingReservation, null);

const built = buildAssistantResponse(
  JSON.stringify({
    message: "Cotización lista.",
    actionTypes: ["reserve"],
    pendingReservation: null,
  })
);
assert.strictEqual(built.reply, "Cotización lista.");
assert.strictEqual(built.options.length, 1);
assert.strictEqual(built.options[0].url, CHAT_ACTIONS.reserve.url);
assert.ok(!built.options[0].url.includes("checkout.wompi"));

const legacy = buildAssistantResponse(
  `Texto visible\n[OPTIONS]\n[{"label":"X","url":"https://evil.example/pay"}]\n[/OPTIONS]`
);
assert.strictEqual(legacy.reply, "Texto visible");
assert.strictEqual(legacy.options.length, 4);
assert.ok(legacy.options.every((o) => !o.url.includes("evil.example")));

console.log("chatActions tests passed");
