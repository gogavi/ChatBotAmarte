/**
 * Rate limiting del endpoint de token (máx. 5 / 10 min por IP).
 */
const assert = require("assert");
const http = require("http");
const express = require("express");

process.env.ELEVENLABS_API_KEY = "test-key";
process.env.ELEVENLABS_AGENT_ID = "agent_test";
process.env.ELEVENLABS_LIVE_ENABLED = "true";

const originalFetch = global.fetch;
global.fetch = async () => ({
  ok: true,
  json: async () => ({ token: "tok" }),
});

// Fresh require path: use a dedicated app with low max for speed
const rateLimit = require("express-rate-limit");
const { validatePageUrl, sanitizeConversationId } = require("../services/liveVoiceValidation");

const app = express();
app.use(express.json());
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate limited" },
});
app.post("/api/elevenlabs/conversation-token", limiter, (req, res) => {
  const id = sanitizeConversationId(req.body?.conversationId);
  const page = validatePageUrl(req.body?.pageUrl);
  if (!id || !page.ok) {
    return res.status(400).json({ error: "bad" });
  }
  return res.json({ conversationToken: "tok" });
});

const server = http.createServer(app);

function post() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      pageUrl: "https://amartesuite.com/",
      roomName: "Home",
    });
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: server.address().port,
        path: "/api/elevenlabs/conversation-token",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => {
          raw += c;
        });
        res.on("end", () => resolve(res.statusCode));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const s1 = await post();
  const s2 = await post();
  const s3 = await post();
  const s4 = await post();
  assert.strictEqual(s1, 200);
  assert.strictEqual(s2, 200);
  assert.strictEqual(s3, 200);
  assert.strictEqual(s4, 429);
  global.fetch = originalFetch;
  await new Promise((r) => server.close(r));
  console.log("rateLimit tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
