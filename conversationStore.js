const { getSupabase, isSupabaseConfigured } = require("./supabaseClient");

const DEFAULT_HISTORY_LIMIT = 40;

/** @type {boolean} */
let ready = false;

/**
 * Inicializa el store de historial (Supabase). Idempotente.
 * @returns {boolean}
 */
function initConversationStore() {
  if (ready && getSupabase()) {
    return true;
  }
  if (!isSupabaseConfigured()) {
    throw new Error(
      "SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas"
    );
  }
  const sb = getSupabase();
  if (!sb) {
    throw new Error("No se pudo crear el cliente Supabase");
  }
  ready = true;
  return true;
}

/**
 * Intenta habilitar el store si aún no lo está (p.ej. env disponible más tarde).
 * @returns {boolean}
 */
function ensureStoreReady() {
  if (ready && getSupabase()) {
    return true;
  }
  try {
    return initConversationStore();
  } catch {
    return false;
  }
}

function isStoreReady() {
  return ready && Boolean(getSupabase());
}

/**
 * Asegura que exista la fila de conversación.
 * @param {string} conversationId
 * @param {{ pageUrl?: string; roomName?: string }} [meta]
 */
async function ensureConversation(conversationId, meta = {}) {
  const sb = getSupabase();
  if (!sb || !conversationId) {
    return;
  }
  const row = {
    id: conversationId,
    updated_at: new Date().toISOString(),
  };
  if (typeof meta.pageUrl === "string" && meta.pageUrl.trim()) {
    row.page_url = meta.pageUrl.trim().slice(0, 2000);
  }
  if (typeof meta.roomName === "string" && meta.roomName.trim()) {
    row.room_name = meta.roomName.trim().slice(0, 500);
  }
  const { error } = await sb.from("chatbot_conversations").upsert(row, {
    onConflict: "id",
    ignoreDuplicates: false,
  });
  if (error) {
    throw new Error(`chatbot_conversations upsert: ${error.message}`);
  }
}

/**
 * @param {string} conversationId
 * @param {number} [limit]
 * @returns {Promise<Array<{ role: string; content: string }>>}
 */
async function getPriorMessages(conversationId, limit = DEFAULT_HISTORY_LIMIT) {
  const sb = getSupabase();
  if (!sb || !conversationId) {
    return [];
  }
  const { data, error } = await sb
    .from("chatbot_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("getPriorMessages:", error.message);
    return [];
  }
  const rows = Array.isArray(data) ? data : [];
  return rows.reverse().map((r) => ({
    role: r.role,
    content: r.content,
  }));
}

/**
 * @param {string} conversationId
 * @param {string} userContent
 * @param {string} assistantRawContent
 * @param {{ pageUrl?: string; roomName?: string }} [meta]
 */
async function appendTurn(
  conversationId,
  userContent,
  assistantRawContent,
  meta = {}
) {
  const sb = getSupabase();
  if (!sb || !conversationId) {
    return;
  }
  await ensureConversation(conversationId, meta);
  const { error } = await sb.from("chatbot_messages").insert([
    { conversation_id: conversationId, role: "user", content: userContent },
    {
      conversation_id: conversationId,
      role: "assistant",
      content: assistantRawContent,
    },
  ]);
  if (error) {
    throw new Error(`chatbot_messages insert: ${error.message}`);
  }
  await sb
    .from("chatbot_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

/**
 * Vincula una reserva creada a la conversación.
 * @param {string} conversationId
 * @param {string} reservationId
 */
async function linkReservation(conversationId, reservationId) {
  const sb = getSupabase();
  if (!sb || !conversationId || !reservationId) {
    return;
  }
  await ensureConversation(conversationId);
  const { error } = await sb
    .from("chatbot_conversations")
    .update({
      reservation_id: reservationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
  if (error) {
    console.warn("linkReservation:", error.message);
  }
}

/**
 * @param {string} conversationId
 * @returns {Promise<string | null>}
 */
async function getLinkedReservationId(conversationId) {
  const sb = getSupabase();
  if (!sb || !conversationId) {
    return null;
  }
  const { data, error } = await sb
    .from("chatbot_conversations")
    .select("reservation_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data.reservation_id || null;
}

module.exports = {
  initConversationStore,
  ensureStoreReady,
  isStoreReady,
  getPriorMessages,
  appendTurn,
  linkReservation,
  getLinkedReservationId,
  ensureConversation,
};
