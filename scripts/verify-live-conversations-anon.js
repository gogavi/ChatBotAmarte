#!/usr/bin/env node
"use strict";

/**
 * Comprueba que la clave anon no puede usar public.live_conversations.
 *
 *   SUPABASE_ANON_KEY=... node scripts/verify-live-conversations-anon.js
 *
 * También acepta SUPABASE_PUBLISHABLE_KEY. SUPABASE_URL es opcional
 * (por defecto el proyecto dftbelnombbtjryqphaa).
 *
 * El SELECT filtra id=-1 y pide solo la columna id. Si ese SELECT no es
 * un 42501, el script no intenta INSERT, UPDATE ni DELETE.
 * Sale 0 solo si /auth/v1/settings acepta la clave y select, insert,
 * update y delete responden 42501 (o permission denied / row-level security).
 * Un 401 de clave inválida sale 2: no cuenta como tabla cerrada.
 */

const fs = require("fs");
const path = require("path");
const { trimEnv } = require("../supabaseClient");

const TABLE = "live_conversations";
const DEFAULT_URL = "https://dftbelnombbtjryqphaa.supabase.co";
const IMPOSSIBLE_ID = "-1";

function responseParts(body) {
  const code =
    body && typeof body === "object" && body.code != null
      ? String(body.code)
      : "";
  const message =
    body && typeof body === "object"
      ? String(body.message || body.error || body.msg || "")
      : String(body || "");
  return { code, message, lower: message.toLowerCase() };
}

/**
 * denied: la tabla rechazó la operación.
 * auth_failure: la clave no llegó a Postgres.
 * open: la operación fue aceptada.
 * unexpected: otra respuesta. No es un cierre.
 * @returns {"denied"|"auth_failure"|"open"|"unexpected"}
 */
function classifyAccess(status, body) {
  const { code, lower } = responseParts(body);
  const tableDenied =
    code === "42501" ||
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("row level security");
  if (tableDenied) {
    return "denied";
  }
  const authFailure =
    code === "PGRST301" ||
    code === "PGRST302" ||
    lower.includes("invalid api key") ||
    lower.includes("jwt") ||
    status === 401 ||
    status === 403;
  if (authFailure) {
    return "auth_failure";
  }
  if (status >= 200 && status < 300) {
    return "open";
  }
  return "unexpected";
}

function isAnonDenied(status, body) {
  return classifyAccess(status, body) === "denied";
}

function planProbes(selectStatus, selectBody) {
  const selectClass = classifyAccess(selectStatus, selectBody);
  return {
    selectDenied: selectClass === "denied",
    attemptMutations: selectClass === "denied",
  };
}

function hasLiveTableCall(source) {
  const pattern = new RegExp(
    "\\.from\\(\\s*['\"]" + TABLE + "['\"]\\s*\\)"
  );
  return pattern.test(source);
}

function walkFiles(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "dist"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, acc);
      continue;
    }
    if (/\.(js|mjs|cjs|html)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Falla si algún JS/HTML de public/ o src/ nombra la tabla o crea un
 * cliente Supabase, o si otro archivo de runtime hace .from(la tabla).
 * @param {string} root
 * @returns {string[]}
 */
function scanClientUsage(root) {
  const offenders = [];
  const files = walkFiles(root, []);
  const storeRel = path.normalize("conversationStore.js");
  for (const full of files) {
    const rel = path.relative(root, full).split(path.sep).join("/");
    const source = fs.readFileSync(full, "utf8");
    const inBrowser =
      rel.startsWith("public/") || rel.startsWith("src/");
    if (
      inBrowser &&
      (source.includes(TABLE) ||
        source.includes("@supabase/supabase-js") ||
        source.includes("SUPABASE_ANON") ||
        source.includes("createClient("))
    ) {
      offenders.push(rel + ": cliente o tabla en el browser");
    }
    if (hasLiveTableCall(source) && path.normalize(rel) !== storeRel) {
      offenders.push(rel + ": .from(live_conversations) fuera del store");
    }
  }

  const clientPath = path.join(root, "supabaseClient.js");
  let client;
  try {
    client = fs.readFileSync(clientPath, "utf8");
  } catch (err) {
    offenders.push("supabaseClient.js: no se puede leer");
    return offenders;
  }
  if (!client.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    offenders.push("supabaseClient.js: no usa SUPABASE_SERVICE_ROLE_KEY");
  }
  if (/SUPABASE_ANON|anon[_-]?key/i.test(client)) {
    offenders.push("supabaseClient.js: referencia una clave anon");
  }
  return offenders;
}

function summarizeBody(body) {
  if (Array.isArray(body)) {
    return "rows=" + body.length;
  }
  if (body && typeof body === "object") {
    const code = body.code ? String(body.code) : "";
    const message = String(body.message || body.error || "").slice(0, 160);
    return [code, message].filter(Boolean).join(" ");
  }
  return "";
}

async function restCall(baseUrl, key, method, query, body) {
  const endpoint =
    baseUrl.replace(/\/$/, "") +
    "/rest/v1/" +
    TABLE +
    (query ? "?" + query : "");
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
    Accept: "application/json",
    Prefer: "return=minimal",
  };
  if (body != null) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(endpoint, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      parsed = { message: text.slice(0, 200) };
    }
  }
  return { status: response.status, body: parsed };
}

function describe(response) {
  return {
    status: response.status,
    body: response.body,
    access: classifyAccess(response.status, response.body),
    denied: isAnonDenied(response.status, response.body),
  };
}

async function acceptAnonKey(baseUrl, key) {
  // /rest/v1/ en este proyecto solo acepta service_role. /auth/v1/settings
  // responde 200 con la clave anon y 401 si la clave no sirve.
  const response = await fetch(baseUrl.replace(/\/$/, "") + "/auth/v1/settings", {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      Accept: "application/json",
    },
  });
  await response.text();
  return response.status;
}

async function probeTable(baseUrl, key) {
  const select = describe(
    await restCall(
      baseUrl,
      key,
      "GET",
      "id=eq." + IMPOSSIBLE_ID + "&select=id",
      null
    )
  );
  const plan = planProbes(select.status, select.body);
  const results = [{ op: "select", ...select }];
  if (!plan.attemptMutations) {
    return {
      ok: false,
      results,
      skippedMutations: true,
      selectAccess: select.access,
    };
  }

  const patch = describe(
    await restCall(baseUrl, key, "PATCH", "id=eq." + IMPOSSIBLE_ID, {
      updated_at: "2000-01-01T00:00:00.000Z",
    })
  );
  results.push({ op: "update", ...patch });

  const del = describe(
    await restCall(baseUrl, key, "DELETE", "id=eq." + IMPOSSIBLE_ID, null)
  );
  results.push({ op: "delete", ...del });

  const probeId = "rls-anon-probe-" + Date.now();
  const insert = describe(
    await restCall(baseUrl, key, "POST", "", {
      elevenlabs_conversation_id: probeId,
      status: "rls-probe",
    })
  );
  results.push({ op: "insert", probeId, ...insert });
  if (!insert.denied && insert.status >= 200 && insert.status < 300) {
    const cleanup = describe(
      await restCall(
        baseUrl,
        key,
        "DELETE",
        "elevenlabs_conversation_id=eq." + encodeURIComponent(probeId),
        null
      )
    );
    results.push({ op: "insert_cleanup", probeId, ...cleanup });
  }

  return {
    ok: results.every((row) => row.denied),
    results,
    skippedMutations: false,
    selectAccess: select.access,
  };
}

async function main() {
  const key = trimEnv(
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ""
  );
  if (!key) {
    console.error(
      "Falta SUPABASE_ANON_KEY o SUPABASE_PUBLISHABLE_KEY. No se usa la service role."
    );
    process.exit(2);
  }
  const baseUrl = trimEnv(process.env.SUPABASE_URL || DEFAULT_URL);
  const controlStatus = await acceptAnonKey(baseUrl, key);
  console.log("control status=" + controlStatus);
  if (controlStatus !== 200) {
    console.error(
      "La clave anon no fue aceptada por el Data API. No se comprobó la tabla."
    );
    process.exit(2);
  }
  const report = await probeTable(baseUrl, key);
  for (const row of report.results) {
    console.log(
      row.op +
        " status=" +
        row.status +
        " access=" +
        row.access +
        (row.probeId ? " probeId=" + row.probeId : "") +
        " " +
        summarizeBody(row.body)
    );
  }
  if (report.results.some((row) => row.access === "auth_failure")) {
    console.error(
      "La respuesta es un fallo de autenticación, no un rechazo de la tabla."
    );
    process.exit(2);
  }
  if (report.selectAccess === "open") {
    console.error(
      "anon todavía puede consultar live_conversations. No se enviaron escrituras."
    );
    process.exit(1);
  }
  if (!report.ok) {
    const inserted = report.results.find(
      (row) => row.op === "insert" && row.access === "open"
    );
    if (inserted) {
      const cleanup = report.results.find((row) => row.op === "insert_cleanup");
      console.error(
        "INSERT de prueba llegó a la tabla. probeId=" +
          inserted.probeId +
          " cleanup_status=" +
          (cleanup ? cleanup.status : "no-enviado")
      );
    }
    console.error("anon todavía puede usar live_conversations.");
    process.exit(1);
  }
  console.log("anon no puede select, insert, update ni delete.");
}

if (require.main === module) {
  main().catch((err) => {
    const message = err && err.message ? err.message : String(err);
    console.error(message);
    process.exit(1);
  });
}

module.exports = {
  classifyAccess,
  isAnonDenied,
  planProbes,
  scanClientUsage,
  probeTable,
  summarizeBody,
};
