/**
 * Topes de Martina en texto y nota de voz.
 * 30 mensajes por conversationId mientras el proceso vive.
 * 60 por IP en una hora, solo en /chat y /chat/audio.
 */

const rateLimit = require("express-rate-limit");

const CHAT_CONVERSATION_LIMIT = 30;
const CHAT_IP_LIMIT = 60;
const WINDOW_MS = 60 * 60 * 1000;

const CHAT_CONVERSATION_LIMIT_ERROR =
  "Vas muy rápido. Espera un momento y vuelve a escribirle a Martina.";
const CHAT_IP_LIMIT_ERROR =
  "Hay demasiados mensajes desde esta conexión. Intenta de nuevo más tarde.";

const CONVERSATION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} conversationId
 * @returns {string | null}
 */
function conversationRateKey(conversationId) {
  if (typeof conversationId !== "string") return null;
  const value = conversationId.trim();
  if (!value || value.length > 64 || !CONVERSATION_ID_RE.test(value)) return null;
  return value.toLowerCase();
}

/**
 * @param {string} error
 * @returns {import("express").RequestHandler}
 */
function tooMany(error) {
  return function chatRateLimitHandler(_req, res) {
    res.status(429).json({ error });
  };
}

const chatIpHourlyLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: CHAT_IP_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany(CHAT_IP_LIMIT_ERROR),
});

const conversationCounts = new Map();
const CONVERSATION_CAP_KEYS = 10000;

/**
 * No usa ventana: el cupo de 30 no se reinicia a la hora.
 * @type {import("express").RequestHandler}
 */
function chatConversationLimiter(req, res, next) {
  const key = conversationRateKey(req.body && req.body.conversationId);
  if (!key) {
    next();
    return;
  }
  if (conversationCounts.size >= CONVERSATION_CAP_KEYS && !conversationCounts.has(key)) {
    const oldest = conversationCounts.keys().next().value;
    conversationCounts.delete(oldest);
  }
  const hits = (conversationCounts.get(key) || 0) + 1;
  conversationCounts.set(key, hits);
  if (hits > CHAT_CONVERSATION_LIMIT) {
    res.status(429).json({ error: CHAT_CONVERSATION_LIMIT_ERROR });
    return;
  }
  next();
}

module.exports = {
  CHAT_CONVERSATION_LIMIT,
  CHAT_IP_LIMIT,
  CHAT_CONVERSATION_LIMIT_ERROR,
  CHAT_IP_LIMIT_ERROR,
  conversationRateKey,
  chatIpHourlyLimiter,
  chatConversationLimiter,
};
