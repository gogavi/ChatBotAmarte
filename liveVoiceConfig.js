/**
 * Configuración del modo “Hablar en vivo con Martina”.
 * Proveedor seleccionable vía VOICE_AGENT_PROVIDER (elevenlabs | openai).
 * Secretos nunca se exportan al navegador.
 */

const ALLOWED_PAGE_HOSTS = new Set([
  "amartesuite.com",
  "www.amartesuite.com",
  // Demo embebido en Railway (embed-demo.html)
  "chatbotamarte-production.up.railway.app",
  // Front Vite del rediseño (dev)
  "localhost",
  "127.0.0.1",
]);

/**
 * Hosts extra desde env (coma-separados), p. ej. previews.
 * @returns {string[]}
 */
function getExtraAllowedPageHosts() {
  const raw = String(process.env.ELEVENLABS_ALLOWED_PAGE_HOSTS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** Rate limit del endpoint de token WebRTC. */
const TOKEN_RATE_LIMIT = Object.freeze({
  windowMs: 10 * 60 * 1000,
  max: 5,
});

/** Timeout para llamadas a la API de ElevenLabs (ms). */
const ELEVENLABS_FETCH_TIMEOUT_MS = 15000;

/** Límites de longitud de campos del body. */
const FIELD_LIMITS = Object.freeze({
  conversationId: 64,
  pageUrl: 2000,
  roomName: 500,
});

/**
 * Proveedor de agente de voz activo.
 * @returns {'elevenlabs'|'openai'}
 */
function getVoiceAgentProvider() {
  const raw = String(process.env.VOICE_AGENT_PROVIDER || "elevenlabs")
    .trim()
    .toLowerCase();
  return raw === "openai" ? "openai" : "elevenlabs";
}

/**
 * @returns {boolean}
 */
function isLiveVoiceEnabled() {
  const provider = getVoiceAgentProvider();
  // OpenAI Realtime aún no implementado: no mostrar botón que falla.
  if (provider === "openai") {
    return false;
  }

  const raw = String(process.env.ELEVENLABS_LIVE_ENABLED || "")
    .trim()
    .toLowerCase();
  // Opt-in explícito: el botón solo aparece con ELEVENLABS_LIVE_ENABLED=true.
  // (Desactivado por ahora; reactivar en Railway/.env cuando el modo en vivo esté listo.)
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

/**
 * @returns {boolean}
 */
function isElevenLabsAgentConfigured() {
  return Boolean(
    process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID
  );
}

/**
 * @returns {string}
 */
function getElevenLabsEnvironment() {
  const env = String(process.env.ELEVENLABS_ENVIRONMENT || "production").trim();
  return env || "production";
}

/**
 * ¿Se permiten hosts locales para pageUrl? (demo / desarrollo).
 * @returns {boolean}
 */
function allowLocalPageHosts() {
  if (process.env.ELEVENLABS_ALLOW_LOCAL_PAGE_HOSTS === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

/**
 * @param {string} hostname
 * @returns {boolean}
 */
function isAllowedPageHost(hostname) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase();
  if (!host) {
    return false;
  }
  if (ALLOWED_PAGE_HOSTS.has(host)) {
    return true;
  }
  if (getExtraAllowedPageHosts().includes(host)) {
    return true;
  }
  if (allowLocalPageHosts()) {
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".localhost")
    );
  }
  return false;
}

module.exports = {
  ALLOWED_PAGE_HOSTS,
  TOKEN_RATE_LIMIT,
  ELEVENLABS_FETCH_TIMEOUT_MS,
  FIELD_LIMITS,
  getVoiceAgentProvider,
  isLiveVoiceEnabled,
  isElevenLabsAgentConfigured,
  getElevenLabsEnvironment,
  allowLocalPageHosts,
  isAllowedPageHost,
};
