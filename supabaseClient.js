const { createClient } = require("@supabase/supabase-js");

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
let client = null;

/**
 * Cliente Supabase con service role (solo backend).
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
function getSupabase() {
  if (client) {
    return client;
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

module.exports = {
  getSupabase,
  isSupabaseConfigured,
};
