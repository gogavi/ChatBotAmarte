/**
 * Tests de herramientas del agente (auth + catalog/actions) con servidor efímero.
 */
const assert = require("assert");
const http = require("http");
const express = require("express");

process.env.ELEVENLABS_TOOL_SECRET = "test-tool-secret";

const {
  setRoomRatesCacheForTests,
  resetRoomRatesCache,
} = require("../services/roomRatesCatalog");

// Forzar fallback estático (sin depender de Supabase del entorno).
resetRoomRatesCache();
setRoomRatesCacheForTests(null);

const agentToolsRouter = require("../routes/agentTools");

const app = express();
app.use(express.json());
app.use("/api/agent-tools", agentToolsRouter);
const server = http.createServer(app);

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: server.address().port,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
          ...(headers || {}),
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
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));

  const unauthorized = await request("POST", "/api/agent-tools/catalog", {
    suite: "VIP Jacuzzi",
    date: "2026-07-09",
    duration: "8 horas",
  });
  assert.strictEqual(unauthorized.status, 401);

  const catalog = await request(
    "POST",
    "/api/agent-tools/catalog",
    {
      suite: "VIP Jacuzzi",
      date: "2026-07-09",
      duration: "8 horas",
    },
    { Authorization: "Bearer test-tool-secret" }
  );
  assert.strictEqual(catalog.status, 200);
  assert.strictEqual(catalog.body.found, true);
  assert.strictEqual(catalog.body.priceCop, 200000);
  assert.strictEqual(catalog.body.source, "fallback");

  // Con mock BD: Diamante 4h weekday = 240000
  setRoomRatesCacheForTests(
    new Map([
      [
        "Suite Diamante",
        {
          name: "Suite Diamante",
          kind: "suite",
          weekday: { h4: 240000, h8: 280000 },
          weekend: { h4: 300000, h8: 350000 },
        },
      ],
    ])
  );
  const diamante = await request(
    "POST",
    "/api/agent-tools/catalog",
    {
      suite: "Suite Diamante",
      date: "2026-07-09",
      duration: "4 horas",
    },
    { Authorization: "Bearer test-tool-secret" }
  );
  assert.strictEqual(diamante.status, 200);
  assert.strictEqual(diamante.body.priceCop, 240000);
  assert.strictEqual(diamante.body.source, "supabase");
  resetRoomRatesCache();
  setRoomRatesCacheForTests(null);

  const actions = await request(
    "POST",
    "/api/agent-tools/actions",
    {},
    { Authorization: "Bearer test-tool-secret" }
  );
  assert.strictEqual(actions.status, 200);
  assert.ok(actions.body.reservation.url.includes("amartesuite.com"));
  assert.ok(actions.body.whatsapp.url.includes("wa.me"));
  assert.ok(actions.body.payment.url.includes("wompi"));

  await new Promise((r) => server.close(r));
  console.log("agentTools tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
