/**
 * Tope real montado en las rutas: 30 mensajes por conversación y 60 por hora por IP.
 * No llama a OpenAI: el cuerpo no trae message, así que el handler responde 400
 * antes de historial o de prerreserva.
 */
const assert = require("assert");
const http = require("http");

process.env.OPENAI_API_KEY = "";
process.env.PORT = "0";

const { app } = require("../server");
const {
  CHAT_CONVERSATION_LIMIT,
  CHAT_IP_LIMIT,
  CHAT_CONVERSATION_LIMIT_ERROR,
  CHAT_IP_LIMIT_ERROR,
} = require("../services/chatRateLimit");

assert.strictEqual(CHAT_CONVERSATION_LIMIT, 30);
assert.strictEqual(CHAT_IP_LIMIT, 60);

function post(port, path, body, ip) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          "X-Forwarded-For": ip,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let parsed = {};
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = { raw };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const conversationId = "550e8400-e29b-41d4-a716-446655440000";

  try {
    for (let i = 0; i < CHAT_CONVERSATION_LIMIT; i += 1) {
      const res = await post(
        port,
        "/chat",
        { conversationId, message: "" },
        "203.0.113.10"
      );
      assert.notStrictEqual(res.status, 429, `mensaje ${i + 1} no debe ser 429`);
    }
    const blockedConversation = await post(
      port,
      "/chat",
      { conversationId, message: "hola" },
      "203.0.113.10"
    );
    assert.strictEqual(blockedConversation.status, 429);
    assert.strictEqual(blockedConversation.body.error, CHAT_CONVERSATION_LIMIT_ERROR);

    const otherConversation = await post(
      port,
      "/chat",
      {
        conversationId: "550e8400-e29b-41d4-a716-446655440001",
        message: "",
      },
      "203.0.113.11"
    );
    assert.notStrictEqual(otherConversation.status, 429);

    for (let i = 0; i < CHAT_IP_LIMIT; i += 1) {
      const res = await post(port, "/chat", { message: "" }, "203.0.113.20");
      assert.notStrictEqual(res.status, 429, `ip ${i + 1}`);
    }
    const blockedIp = await post(
      port,
      "/chat",
      { message: "hola" },
      "203.0.113.20"
    );
    assert.strictEqual(blockedIp.status, 429);
    assert.strictEqual(blockedIp.body.error, CHAT_IP_LIMIT_ERROR);

    for (let i = 0; i < CHAT_IP_LIMIT; i += 1) {
      const res = await post(port, "/chat", { message: "" }, "203.0.113.30");
      assert.notStrictEqual(res.status, 429, `chat antes de pending ${i + 1}`);
    }
    const pendingAfterChat = await post(
      port,
      "/reservations/pending",
      { conversationId },
      "203.0.113.30"
    );
    assert.notStrictEqual(pendingAfterChat.status, 429);
    const blockedSameIp = await post(
      port,
      "/chat",
      { message: "hola" },
      "203.0.113.30"
    );
    assert.strictEqual(blockedSameIp.status, 429);
    assert.strictEqual(blockedSameIp.body.error, CHAT_IP_LIMIT_ERROR);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log("chatRatePolicy.test.js ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
