const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
let client = null;

/** @type {string | null} */
let lastClientError = null;

/**
 * Normaliza env: trim + quita comillas envolventes (común en Railway/Docker).
 * @param {unknown} value
 * @returns {string}
 */
function trimEnv(value) {
  if (typeof value !== "string") {
    return "";
  }
  let s = value.trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function getSupabaseUrl() {
  return trimEnv(process.env.SUPABASE_URL);
}

function getSupabaseServiceKey() {
  return trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Cliente Supabase con service role (solo backend).
 * Usa `ws` como transport de realtime (Node < 22 no trae WebSocket nativo).
 * Nunca lanza: si falla el init, retorna null (el chat sigue con memoria).
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
function getSupabase() {
  if (client) {
    return client;
  }
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) {
    return null;
  }
  try {
    client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        transport: WebSocket,
      },
    });
    lastClientError = null;
    return client;
  } catch (err) {
    lastClientError =
      err && err.message
        ? String(err.message)
        : "Error al crear cliente Supabase";
    console.warn("Supabase client init failed:", lastClientError);
    return null;
  }
}

function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

function getLastSupabaseClientError() {
  return lastClientError;
}

/** Reinicia el cliente (p.ej. tras cambiar env en tests). */
function resetSupabaseClient() {
  client = null;
  lastClientError = null;
}

module.exports = {
  getSupabase,
  isSupabaseConfigured,
  resetSupabaseClient,
  getLastSupabaseClientError,
  trimEnv,
};
