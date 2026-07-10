/**
 * Tests del endpoint de token: sin config, dominio externo, suite por URL (mock fetch).
 */
const assert = require("assert");
const http = require("http");
const express = require("express");

const prevKey = process.env.ELEVENLABS_API_KEY;
const prevAgent = process.env.ELEVENLABS_AGENT_ID;
const prevLive = process.env.ELEVENLABS_LIVE_ENABLED;

delete process.env.ELEVENLABS_API_KEY;
delete process.env.ELEVENLABS_AGENT_ID;
process.env.ELEVENLABS_LIVE_ENABLED = "true";

// Re-require after env change — module reads env at request time, OK
const elevenlabsTokenRouter = require("../routes/elevenlabsToken");
const { matchSuiteFromPageUrl } = require("../config/suitePageHints");

const suite = matchSuiteFromPageUrl(
  "https://amartesuite.com/producto/suite-vip-jacuzzi/"
);
assert.ok(suite);
assert.ok(
  String(suite.detectedSuiteLabel || "")
    .toLowerCase()
    .includes("jacuzzi")
);

const app = express();
app.use(express.json());
app.use("/api", elevenlabsTokenRouter);
const server = http.createServer(app);

function post(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
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
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));

  const noConfig = await post({
    conversationId: "550e8400-e29b-41d4-a716-446655440000",
    pageUrl: "https://amartesuite.com/",
    roomName: "Home",
  });
  assert.strictEqual(noConfig.status, 503);

  // Con config pero dominio externo
  process.env.ELEVENLABS_API_KEY = "test-key";
  process.env.ELEVENLABS_AGENT_ID = "agent_test";

  const badDomain = await post({
    conversationId: "550e8400-e29b-41d4-a716-446655440000",
    pageUrl: "https://evil.example.com/",
    roomName: "Hack",
  });
  assert.strictEqual(badDomain.status, 400);

  // Mock fetch de ElevenLabs
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return {
      ok: true,
      json: async () => ({ token: "fake-webrtc-token" }),
    };
  };

  const ok = await post({
    conversationId: "550e8400-e29b-41d4-a716-446655440000",
    pageUrl: "https://amartesuite.com/producto/suite-vip-jacuzzi/",
    roomName: "ignored",
  });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.conversationToken, "fake-webrtc-token");
  assert.strictEqual(ok.body.context.source, "amarte_website");
  assert.ok(ok.body.context.suiteContext);
  assert.ok(ok.body.context.referenceDate);
  assert.strictEqual(fetchCalls, 1);

  // Fallback: ElevenLabs caído
  global.fetch = async () => {
    throw new Error("network down");
  };
  const down = await post({
    conversationId: "550e8400-e29b-41d4-a716-446655440000",
    pageUrl: "https://amartesuite.com/",
    roomName: "Home",
  });
  assert.strictEqual(down.status, 502);

  global.fetch = originalFetch;
  await new Promise((r) => server.close(r));

  if (prevKey === undefined) delete process.env.ELEVENLABS_API_KEY;
  else process.env.ELEVENLABS_API_KEY = prevKey;
  if (prevAgent === undefined) delete process.env.ELEVENLABS_AGENT_ID;
  else process.env.ELEVENLABS_AGENT_ID = prevAgent;
  if (prevLive === undefined) delete process.env.ELEVENLABS_LIVE_ENABLED;
  else process.env.ELEVENLABS_LIVE_ENABLED = prevLive;

  console.log("conversationToken tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
