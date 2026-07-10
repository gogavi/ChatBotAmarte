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

/**
 * Crea o actualiza una fila de conversación en vivo (idempotente por elevenlabs id).
 * @param {{
 *   localConversationId?: string|null;
 *   elevenlabsConversationId: string;
 *   agentId?: string|null;
 *   status?: string|null;
 *   suiteContext?: string|null;
 * }} data
 */
async function createLiveConversation(data) {
  const sb = getSupabase();
  if (!sb || !data?.elevenlabsConversationId) {
    return null;
  }
  const row = {
    elevenlabs_conversation_id: String(data.elevenlabsConversationId).slice(
      0,
      200
    ),
    updated_at: new Date().toISOString(),
  };
  if (data.localConversationId) {
    row.local_conversation_id = String(data.localConversationId).slice(0, 64);
  }
  if (data.agentId) {
    row.agent_id = String(data.agentId).slice(0, 200);
  }
  if (data.status) {
    row.status = String(data.status).slice(0, 100);
  }
  if (data.suiteContext) {
    row.suite_context = String(data.suiteContext).slice(0, 500);
  }
  const { data: upserted, error } = await sb
    .from("live_conversations")
    .upsert(row, { onConflict: "elevenlabs_conversation_id" })
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("createLiveConversation:", error.message);
    return null;
  }
  return upserted;
}

/**
 * Actualiza campos de una conversación en vivo.
 * @param {string} elevenlabsConversationId
 * @param {Record<string, unknown>} patch
 */
async function updateLiveConversation(elevenlabsConversationId, patch = {}) {
  const sb = getSupabase();
  if (!sb || !elevenlabsConversationId) {
    return null;
  }
  const row = {
    updated_at: new Date().toISOString(),
  };
  if (patch.localConversationId != null) {
    row.local_conversation_id = String(patch.localConversationId).slice(0, 64);
  }
  if (patch.agentId != null) {
    row.agent_id = String(patch.agentId).slice(0, 200);
  }
  if (patch.status != null) {
    row.status = String(patch.status).slice(0, 100);
  }
  if (patch.durationSeconds != null && Number.isFinite(patch.durationSeconds)) {
    row.duration_seconds = Math.round(Number(patch.durationSeconds));
  }
  if (patch.summary != null) {
    row.summary = String(patch.summary).slice(0, 20000);
  }
  if (patch.transcript != null) {
    row.transcript_json = patch.transcript;
  }
  if (patch.analysis != null) {
    row.analysis_json = patch.analysis;
  }
  if (patch.suiteContext != null) {
    row.suite_context = String(patch.suiteContext).slice(0, 500);
  }
  if (patch.bookingIntent != null) {
    row.booking_intent = Boolean(patch.bookingIntent);
  }

  const { data, error } = await sb
    .from("live_conversations")
    .update(row)
    .eq("elevenlabs_conversation_id", String(elevenlabsConversationId))
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("updateLiveConversation:", error.message);
    return null;
  }
  return data;
}

/**
 * Upsert idempotente con datos del webhook post-call.
 * @param {{
 *   localConversationId?: string|null;
 *   elevenlabsConversationId: string;
 *   agentId?: string|null;
 *   status?: string|null;
 *   durationSeconds?: number|null;
 *   summary?: string|null;
 *   transcript?: unknown;
 *   analysis?: unknown;
 *   suiteContext?: string|null;
 *   bookingIntent?: boolean;
 * }} data
 */
async function savePostCallData(data) {
  const sb = getSupabase();
  if (!sb || !data?.elevenlabsConversationId) {
    return null;
  }
  const row = {
    elevenlabs_conversation_id: String(data.elevenlabsConversationId).slice(
      0,
      200
    ),
    updated_at: new Date().toISOString(),
  };
  if (data.localConversationId) {
    row.local_conversation_id = String(data.localConversationId).slice(0, 64);
  }
  if (data.agentId) {
    row.agent_id = String(data.agentId).slice(0, 200);
  }
  if (data.status) {
    row.status = String(data.status).slice(0, 100);
  }
  if (data.durationSeconds != null && Number.isFinite(data.durationSeconds)) {
    row.duration_seconds = Math.round(Number(data.durationSeconds));
  }
  if (data.summary != null) {
    row.summary = String(data.summary).slice(0, 20000);
  }
  if (data.transcript != null) {
    row.transcript_json = data.transcript;
  }
  if (data.analysis != null) {
    row.analysis_json = data.analysis;
  }
  if (data.suiteContext != null) {
    row.suite_context = String(data.suiteContext).slice(0, 500);
  }
  if (data.bookingIntent != null) {
    row.booking_intent = Boolean(data.bookingIntent);
  }

  const { data: upserted, error } = await sb
    .from("live_conversations")
    .upsert(row, { onConflict: "elevenlabs_conversation_id" })
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("savePostCallData:", error.message);
    return null;
  }
  return upserted;
}

/**
 * @param {string} elevenlabsConversationId
 */
async function getLiveConversation(elevenlabsConversationId) {
  const sb = getSupabase();
  if (!sb || !elevenlabsConversationId) {
    return null;
  }
  const { data, error } = await sb
    .from("live_conversations")
    .select("*")
    .eq("elevenlabs_conversation_id", String(elevenlabsConversationId))
    .maybeSingle();
  if (error) {
    console.warn("getLiveConversation:", error.message);
    return null;
  }
  return data;
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
  createLiveConversation,
  updateLiveConversation,
  savePostCallData,
  getLiveConversation,
};
