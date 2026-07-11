/**
 * Estados de sesión de voz independientes del proveedor.
 * Los providers mapean eventos nativos a estos valores.
 */

/** @typedef {'idle'|'connecting'|'connected'|'listening'|'thinking'|'speaking'|'muted'|'disconnected'|'error'} VoiceAgentState */

/** @type {Readonly<Record<string, VoiceAgentState>>} */
export const VOICE_AGENT_STATES = Object.freeze({
  IDLE: "idle",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  LISTENING: "listening",
  THINKING: "thinking",
  SPEAKING: "speaking",
  MUTED: "muted",
  DISCONNECTED: "disconnected",
  ERROR: "error",
});

/** @type {ReadonlySet<string>} */
const VALID = new Set(Object.values(VOICE_AGENT_STATES));

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isValidVoiceAgentState(status) {
  return VALID.has(String(status || ""));
}
