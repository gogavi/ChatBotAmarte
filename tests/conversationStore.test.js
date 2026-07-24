/**
 * Tests del store de historial: memoria write-through, métricas y puente live.
 */
const assert = require("assert");

// Sin Supabase: solo memoria
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { resetSupabaseClient } = require("../supabaseClient");
resetSupabaseClient();

const store = require("../conversationStore");
store._resetForTests();
store.initConversationStore();

assert.strictEqual(store.isStoreReady(), true);
assert.strictEqual(store.isSupabasePersistenceEnabled(), false);
assert.ok(store.getLastInitError());

const convId = "550e8400-e29b-41d4-a716-446655440000";

(async () => {
  await store.appendTurn(convId, "Me llamo Ana", '{"message":"Hola Ana"}');
  let prior = await store.getPriorMessages(convId);
  assert.strictEqual(prior.length, 2);
  assert.strictEqual(prior[0].role, "user");
  assert.strictEqual(prior[0].content, "Me llamo Ana");
  assert.strictEqual(prior[1].role, "assistant");

  await store.appendTurn(convId, "¿Cómo me llamo?", '{"message":"Ana"}');
  prior = await store.getPriorMessages(convId);
  assert.strictEqual(prior.length, 4);
  assert.ok(prior.some((m) => m.content === "¿Cómo me llamo?"));

  const metrics = store.getHistoryMetrics();
  assert.ok(metrics.history_write_ok >= 2);
  assert.ok(metrics.history_memory_hit >= 1);

  const turns = store.transcriptToTurns([
    { role: "user", message: "Quiero Jacuzzi" },
    { role: "agent", message: "Claro, ¿para cuándo?" },
  ]);
  assert.strictEqual(turns.length, 2);
  assert.strictEqual(turns[0].role, "user");
  assert.strictEqual(turns[1].role, "assistant");

  const bridged = await store.bridgeLiveToChatHistory({
    localConversationId: convId,
    elevenlabsConversationId: "el_conv_abc",
    transcript: [
      { role: "user", message: "Hola desde live" },
      { role: "agent", message: "Hola, soy Martina" },
    ],
  });
  assert.strictEqual(bridged, true);
  prior = await store.getPriorMessages(convId);
  assert.ok(prior.some((m) => String(m.content).includes("[live:el_conv_abc]")));

  const bridgedAgain = await store.bridgeLiveToChatHistory({
    localConversationId: convId,
    elevenlabsConversationId: "el_conv_abc",
    transcript: [{ role: "user", message: "dup" }],
  });
  assert.strictEqual(bridgedAgain, false);

  // trimEnv / comillas
  const { trimEnv } = require("../supabaseClient");
  assert.strictEqual(trimEnv('  "https://x.supabase.co"  '), "https://x.supabase.co");
  assert.strictEqual(trimEnv("'abc'"), "abc");

  console.log("conversationStore.test.js: ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
