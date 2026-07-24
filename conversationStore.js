const { getSupabase, isSupabaseConfigured } = require("./supabaseClient");

const DEFAULT_HISTORY_LIMIT = Math.max(
  10,
  Math.min(200, Number(process.env.CHAT_HISTORY_LIMIT) || 40)
);
const MEMORY_TTL_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.CHAT_HISTORY_MEMORY_TTL_MS) || 2 * 60 * 60 * 1000
);
const MEMORY_MAX_CONVERSATIONS = Math.max(
  50,
  Number(process.env.CHAT_HISTORY_MEMORY_MAX) || 500
);

/** @type {boolean} memoria siempre disponible tras init */
let memoryReady = false;
/** @type {boolean} persistencia Supabase */
let supabaseReady = false;
/** @type {string | null} */
let lastInitError = null;

/**
 * @typedef {{ role: string; content: string }} ChatMessage
 * @typedef {{ messages: ChatMessage[]; updatedAt: number }} MemoryEntry
 */

/** @type {Map<string, MemoryEntry>} */
const memoryCache = new Map();

/** @type {Set<string>} */
const bridgedLiveIds = new Set();

const metrics = {
  history_read_ok: 0,
  history_read_failed: 0,
  history_write_ok: 0,
  history_write_failed: 0,
  history_memory_hit: 0,
  history_memory_miss: 0,
  live_bridge_ok: 0,
  live_bridge_failed: 0,
};

/**
 * @param {string} event
 * @param {Record<string, unknown>} [detail]
 */
function logHistoryEvent(event, detail = {}) {
  console.warn(
    JSON.stringify({
      event,
      ts: new Date().toISOString(),
      ...detail,
    })
  );
}

/**
 * @param {number} [limit]
 */
function resolveLimit(limit) {
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return Math.min(200, Math.floor(limit));
  }
  return DEFAULT_HISTORY_LIMIT;
}

function pruneMemory() {
  const now = Date.now();
  for (const [id, entry] of memoryCache) {
    if (now - entry.updatedAt > MEMORY_TTL_MS) {
      memoryCache.delete(id);
    }
  }
  while (memoryCache.size > MEMORY_MAX_CONVERSATIONS) {
    let oldestId = null;
    let oldestAt = Infinity;
    for (const [id, entry] of memoryCache) {
      if (entry.updatedAt < oldestAt) {
        oldestAt = entry.updatedAt;
        oldestId = id;
      }
    }
    if (!oldestId) {
      break;
    }
    memoryCache.delete(oldestId);
  }
}

/**
 * @param {string} conversationId
 * @param {ChatMessage[]} messages
 */
function setMemory(conversationId, messages) {
  memoryCache.set(conversationId, {
    messages: messages.slice(-DEFAULT_HISTORY_LIMIT * 2),
    updatedAt: Date.now(),
  });
  pruneMemory();
}

/**
 * @param {string} conversationId
 * @param {ChatMessage[]} extra
 */
function appendToMemory(conversationId, extra) {
  const prev = memoryCache.get(conversationId);
  const base = prev ? prev.messages.slice() : [];
  for (const m of extra) {
    if (
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
    ) {
      base.push({ role: m.role, content: m.content });
    }
  }
  setMemory(conversationId, base);
}

/**
 * Inicializa el store (memoria siempre; Supabase si hay credenciales).
 * @returns {boolean}
 */
function initConversationStore() {
  memoryReady = true;
  lastInitError = null;
  supabaseReady = false;

  if (!isSupabaseConfigured()) {
    lastInitError =
      "SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas (tras trim/comillas)";
    return true;
  }
  const sb = getSupabase();
  if (!sb) {
    lastInitError = "No se pudo crear el cliente Supabase";
    return true;
  }
  supabaseReady = true;
  return true;
}

/**
 * @returns {boolean}
 */
function ensureStoreReady() {
  if (memoryReady) {
    if (!supabaseReady && isSupabaseConfigured()) {
      try {
        initConversationStore();
      } catch (e) {
        lastInitError =
          e && e.message ? String(e.message) : "Error al reiniciar store";
      }
    }
    return true;
  }
  try {
    return initConversationStore();
  } catch (e) {
    lastInitError =
      e && e.message ? String(e.message) : "Error al inicializar store";
    memoryReady = true;
    return true;
  }
}

function isStoreReady() {
  return memoryReady;
}

function isSupabasePersistenceEnabled() {
  return supabaseReady && Boolean(getSupabase());
}

function getLastInitError() {
  return lastInitError;
}

function getHistoryMetrics() {
  return { ...metrics, memoryConversations: memoryCache.size };
}

/**
 * @param {string} conversationId
 * @param {{ pageUrl?: string; roomName?: string }} [meta]
 */
async function ensureConversation(conversationId, meta = {}) {
  const sb = getSupabase();
  if (!sb || !supabaseReady || !conversationId) {
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
 * @returns {Promise<ChatMessage[]>}
 */
async function getPriorMessages(conversationId, limit) {
  const capped = resolveLimit(limit);
  if (!conversationId) {
    return [];
  }
  ensureStoreReady();
  pruneMemory();

  const cached = memoryCache.get(conversationId);
  if (cached && cached.messages.length > 0) {
    metrics.history_memory_hit += 1;
    metrics.history_read_ok += 1;
    cached.updatedAt = Date.now();
    return cached.messages.slice(-capped);
  }
  metrics.history_memory_miss += 1;

  const sb = getSupabase();
  if (!sb || !supabaseReady) {
    metrics.history_read_ok += 1;
    return cached ? cached.messages.slice(-capped) : [];
  }

  try {
    let query = sb
      .from("chatbot_messages")
      .select("role, content, created_at, id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(capped);

    let { data, error } = await query;
    if (error) {
      // Fallback si created_at no existe en algún entorno legado
      const fallback = await sb
        .from("chatbot_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("id", { ascending: false })
        .limit(capped);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) {
      metrics.history_read_failed += 1;
      logHistoryEvent("history_read_failed", {
        conversationId: conversationId.slice(0, 8),
        message: error.message,
      });
      return [];
    }
    const rows = Array.isArray(data) ? data : [];
    const messages = rows.reverse().map((r) => ({
      role: r.role,
      content: r.content,
    }));
    setMemory(conversationId, messages);
    metrics.history_read_ok += 1;
    return messages.slice(-capped);
  } catch (err) {
    metrics.history_read_failed += 1;
    logHistoryEvent("history_read_failed", {
      conversationId: conversationId.slice(0, 8),
      message: err && err.message ? err.message : String(err),
    });
    return [];
  }
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
  if (!conversationId) {
    return;
  }
  ensureStoreReady();

  appendToMemory(conversationId, [
    { role: "user", content: userContent },
    { role: "assistant", content: assistantRawContent },
  ]);

  const sb = getSupabase();
  if (!sb || !supabaseReady) {
    metrics.history_write_ok += 1;
    return;
  }

  try {
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
    metrics.history_write_ok += 1;
  } catch (err) {
    metrics.history_write_failed += 1;
    logHistoryEvent("history_write_failed", {
      conversationId: conversationId.slice(0, 8),
      message: err && err.message ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Inserta mensajes sueltos (p.ej. puente live → chat).
 * @param {string} conversationId
 * @param {ChatMessage[]} messages
 * @param {{ pageUrl?: string; roomName?: string }} [meta]
 */
async function appendMessages(conversationId, messages, meta = {}) {
  if (!conversationId || !Array.isArray(messages) || !messages.length) {
    return;
  }
  ensureStoreReady();
  const clean = messages.filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
  );
  if (!clean.length) {
    return;
  }

  appendToMemory(conversationId, clean);

  const sb = getSupabase();
  if (!sb || !supabaseReady) {
    metrics.history_write_ok += 1;
    return;
  }

  try {
    await ensureConversation(conversationId, meta);
    const { error } = await sb.from("chatbot_messages").insert(
      clean.map((m) => ({
        conversation_id: conversationId,
        role: m.role,
        content: m.content,
      }))
    );
    if (error) {
      throw new Error(`chatbot_messages insert: ${error.message}`);
    }
    await sb
      .from("chatbot_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    metrics.history_write_ok += 1;
  } catch (err) {
    metrics.history_write_failed += 1;
    logHistoryEvent("history_write_failed", {
      conversationId: conversationId.slice(0, 8),
      message: err && err.message ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Normaliza transcript ElevenLabs → turnos user/assistant.
 * @param {unknown} transcript
 * @returns {ChatMessage[]}
 */
function transcriptToTurns(transcript) {
  if (typeof transcript === "string" && transcript.trim()) {
    return [
      {
        role: "assistant",
        content: `[Resumen llamada en vivo]\n${transcript.trim().slice(0, 4000)}`,
      },
    ];
  }
  if (!Array.isArray(transcript)) {
    return [];
  }
  /** @type {ChatMessage[]} */
  const turns = [];
  for (const item of transcript) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const text =
      (typeof item.message === "string" && item.message) ||
      (typeof item.content === "string" && item.content) ||
      (typeof item.text === "string" && item.text) ||
      "";
    if (!text.trim()) {
      continue;
    }
    const rawRole = String(item.role || item.speaker || "").toLowerCase();
    let role = null;
    if (
      rawRole === "agent" ||
      rawRole === "assistant" ||
      rawRole === "bot" ||
      rawRole === "ai"
    ) {
      role = "assistant";
    } else if (
      rawRole === "user" ||
      rawRole === "customer" ||
      rawRole === "human"
    ) {
      role = "user";
    } else {
      continue;
    }
    turns.push({ role, content: text.trim().slice(0, 8000) });
  }
  return turns;
}

/**
 * Volca transcript/summary de live a chatbot_messages (mismo conversationId).
 * @param {{
 *   localConversationId?: string|null;
 *   elevenlabsConversationId: string;
 *   transcript?: unknown;
 *   summary?: string|null;
 * }} data
 */
async function bridgeLiveToChatHistory(data) {
  const localId =
    typeof data.localConversationId === "string"
      ? data.localConversationId.trim()
      : "";
  const elId =
    typeof data.elevenlabsConversationId === "string"
      ? data.elevenlabsConversationId.trim()
      : "";
  if (!localId || !elId) {
    return false;
  }

  const marker = `[live:${elId}]`;
  if (bridgedLiveIds.has(elId)) {
    return false;
  }

  const existing = await getPriorMessages(localId, DEFAULT_HISTORY_LIMIT);
  if (existing.some((m) => typeof m.content === "string" && m.content.includes(marker))) {
    bridgedLiveIds.add(elId);
    return false;
  }

  let turns = transcriptToTurns(data.transcript);
  if (!turns.length && data.summary && String(data.summary).trim()) {
    turns = [
      {
        role: "assistant",
        content: `${marker}\n[Resumen de la llamada en vivo]\n${String(data.summary).trim().slice(0, 4000)}`,
      },
    ];
  } else if (turns.length) {
    turns = turns.map((t, i) =>
      i === 0
        ? { ...t, content: `${marker}\n${t.content}` }
        : t
    );
  }

  if (!turns.length) {
    return false;
  }

  try {
    await appendMessages(localId, turns);
    bridgedLiveIds.add(elId);
    metrics.live_bridge_ok += 1;
    logHistoryEvent("live_bridge_ok", {
      conversationId: localId.slice(0, 8),
      elevenlabsId: elId.slice(0, 12),
      turns: turns.length,
    });
    return true;
  } catch (err) {
    metrics.live_bridge_failed += 1;
    logHistoryEvent("live_bridge_failed", {
      conversationId: localId.slice(0, 8),
      message: err && err.message ? err.message : String(err),
    });
    return false;
  }
}

/**
 * @param {string} conversationId
 * @param {string} reservationId
 */
async function linkReservation(conversationId, reservationId) {
  const sb = getSupabase();
  if (!sb || !supabaseReady || !conversationId || !reservationId) {
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
  if (!sb || !supabaseReady || !conversationId) {
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
  if (!sb || !supabaseReady || !data?.elevenlabsConversationId) {
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
 * @param {string} elevenlabsConversationId
 * @param {Record<string, unknown>} patch
 */
async function updateLiveConversation(elevenlabsConversationId, patch = {}) {
  const sb = getSupabase();
  if (!sb || !supabaseReady || !elevenlabsConversationId) {
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
  if (!sb || !supabaseReady || !data?.elevenlabsConversationId) {
    // Aun sin Supabase, puentear a memoria del chat escrito
    if (data?.elevenlabsConversationId) {
      await bridgeLiveToChatHistory({
        localConversationId: data.localConversationId,
        elevenlabsConversationId: data.elevenlabsConversationId,
        transcript: data.transcript,
        summary: data.summary,
      });
    }
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
  }

  await bridgeLiveToChatHistory({
    localConversationId: data.localConversationId,
    elevenlabsConversationId: data.elevenlabsConversationId,
    transcript: data.transcript,
    summary: data.summary,
  });

  return upserted || null;
}

/**
 * @param {string} elevenlabsConversationId
 */
async function getLiveConversation(elevenlabsConversationId) {
  const sb = getSupabase();
  if (!sb || !supabaseReady || !elevenlabsConversationId) {
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

/** Solo tests: limpia caché y métricas. */
function _resetForTests() {
  memoryCache.clear();
  bridgedLiveIds.clear();
  memoryReady = false;
  supabaseReady = false;
  lastInitError = null;
  for (const k of Object.keys(metrics)) {
    metrics[k] = 0;
  }
}

module.exports = {
  initConversationStore,
  ensureStoreReady,
  isStoreReady,
  isSupabasePersistenceEnabled,
  getLastInitError,
  getHistoryMetrics,
  getPriorMessages,
  appendTurn,
  appendMessages,
  transcriptToTurns,
  bridgeLiveToChatHistory,
  linkReservation,
  getLinkedReservationId,
  ensureConversation,
  createLiveConversation,
  updateLiveConversation,
  savePostCallData,
  getLiveConversation,
  DEFAULT_HISTORY_LIMIT,
  _resetForTests,
};
