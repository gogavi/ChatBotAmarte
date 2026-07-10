/**
 * Validación de pageUrl / conversationId para el modo en vivo.
 */

const {
  FIELD_LIMITS,
  isAllowedPageHost,
} = require("../liveVoiceConfig");

const CONVERSATION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function sanitizeConversationId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim().slice(0, FIELD_LIMITS.conversationId);
  if (!CONVERSATION_ID_RE.test(id)) return null;
  return id;
}

/**
 * @param {unknown} pageUrl
 * @returns {{ ok: true; pageUrl: string; pagePath: string; hostname: string } | { ok: false; error: string }}
 */
function validatePageUrl(pageUrl) {
  if (typeof pageUrl !== "string" || !pageUrl.trim()) {
    return { ok: false, error: "pageUrl es obligatorio" };
  }
  const raw = pageUrl.trim().slice(0, FIELD_LIMITS.pageUrl);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "pageUrl inválida" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "pageUrl debe ser http(s)" };
  }
  if (!isAllowedPageHost(parsed.hostname)) {
    return { ok: false, error: "Dominio de pageUrl no permitido" };
  }
  return {
    ok: true,
    pageUrl: parsed.toString(),
    pagePath: parsed.pathname || "/",
    hostname: parsed.hostname,
  };
}

/**
 * @param {unknown} roomName
 * @returns {string}
 */
function sanitizeRoomName(roomName) {
  if (typeof roomName !== "string") return "";
  return roomName.trim().slice(0, FIELD_LIMITS.roomName);
}

module.exports = {
  CONVERSATION_ID_RE,
  sanitizeConversationId,
  validatePageUrl,
  sanitizeRoomName,
};
