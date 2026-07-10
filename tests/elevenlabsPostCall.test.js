/**
 * Tests del webhook post-call: firma inválida, extracción e idempotencia de payload.
 */
const assert = require("assert");
const http = require("http");
const express = require("express");
const crypto = require("crypto");

process.env.ELEVENLABS_CONVAI_WEBHOOK_SECRET = "whsec_test_secret";
process.env.ELEVENLABS_API_KEY = "test-key";

const conversationStore = require("../conversationStore");
const originalSave = conversationStore.savePostCallData;
let saveCalls = 0;
conversationStore.savePostCallData = async (data) => {
  saveCalls += 1;
  return { ...data, id: saveCalls };
};

const {
  extractPostCallPayload,
} = require("../routes/elevenlabsPostCall");

const event = {
  type: "post_call_transcription",
  data: {
    conversation_id: "conv_el_123",
    agent_id: "agent_test",
    status: "done",
    transcript: [{ role: "user", message: "Hola" }],
    analysis: {
      transcript_summary: "Cliente pregunta por Jacuzzi",
      data_collection_results: {
        booking_intent: { value: true },
      },
    },
    metadata: { call_duration_secs: 42 },
    conversation_initiation_client_data: {
      dynamic_variables: {
        conversation_id: "550e8400-e29b-41d4-a716-446655440000",
        suite_context: "Suite VIP Jacuzzi",
      },
    },
  },
};

const parsed = extractPostCallPayload(event);
assert.strictEqual(parsed.elevenlabsConversationId, "conv_el_123");
assert.strictEqual(
  parsed.localConversationId,
  "550e8400-e29b-41d4-a716-446655440000"
);
assert.strictEqual(parsed.bookingIntent, true);
assert.strictEqual(parsed.durationSeconds, 42);
assert.strictEqual(parsed.suiteContext, "Suite VIP Jacuzzi");

const parsed2 = extractPostCallPayload(event);
assert.strictEqual(
  parsed.elevenlabsConversationId,
  parsed2.elevenlabsConversationId
);

const postCallRouter = require("../routes/elevenlabsPostCall");
const app = express();
app.use("/api", postCallRouter);
const server = http.createServer(app);

function postRaw(body, signature) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: server.address().port,
        path: "/api/elevenlabs/post-call",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...(signature ? { "elevenlabs-signature": signature } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => {
          raw += c;
        });
        res.on("end", () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function signBody(rawBody, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp}.${rawBody}`;
  const hex = crypto.createHmac("sha256", secret).update(message).digest("hex");
  return `t=${timestamp},v0=${hex}`;
}

async function run() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));

  const bad = await postRaw(JSON.stringify(event), "t=1,v0=invalid");
  assert.strictEqual(bad.status, 401);

  const noSig = await postRaw(JSON.stringify(event));
  assert.strictEqual(noSig.status, 401);

  const rawBody = JSON.stringify(event);
  const sig = await signBody(
    rawBody,
    process.env.ELEVENLABS_CONVAI_WEBHOOK_SECRET
  );
  saveCalls = 0;
  const ok = await postRaw(rawBody, sig);
  assert.strictEqual(ok.status, 200);

  // Esperar persistencia async
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(saveCalls >= 1);

  // Duplicado: segundo webhook con misma conversación
  const sig2 = await signBody(
    rawBody,
    process.env.ELEVENLABS_CONVAI_WEBHOOK_SECRET
  );
  const ok2 = await postRaw(rawBody, sig2);
  assert.strictEqual(ok2.status, 200);
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(saveCalls >= 2);

  conversationStore.savePostCallData = originalSave;
  await new Promise((r) => server.close(r));
  console.log("elevenlabsPostCall tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
