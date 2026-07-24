const { createClient } = require("@supabase/supabase-js");

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
let client = null;

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
  client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return client;
}

function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

/** Reinicia el cliente (p.ej. tras cambiar env en tests). */
function resetSupabaseClient() {
  client = null;
}

module.exports = {
  getSupabase,
  isSupabaseConfigured,
  resetSupabaseClient,
  trimEnv,
};
