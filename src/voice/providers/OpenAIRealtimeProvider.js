/**
 * Stub de extensión: OpenAI Realtime API.
 *
 * Punto de extensión futuro:
 * 1. Backend: POST /api/openai/realtime-session (emite ephemeral key / session).
 * 2. Cliente: WebRTC o WebSocket hacia OpenAI Realtime.
 * 3. Mapear eventos nativos → VOICE_AGENT_STATES (idle, connecting, connected,
 *    listening, thinking, speaking, muted, disconnected, error).
 * 4. Reutilizar client tools / callbacks del VoiceAgentStartContext
 *    (onTranscript, onShowActions, etc.) sin acoplar el widget a OpenAI.
 *
 * Selección: VOICE_AGENT_PROVIDER=openai
 */

import { VOICE_AGENT_STATES } from "../states.js";

/**
 * @param {import('../VoiceAgentProvider.js').VoiceAgentStartContext | null} callbacks
 * @param {import('../states.js').VoiceAgentState} status
 */
function emitStatus(callbacks, status) {
  if (!callbacks) return;
  if (typeof callbacks.onStatus === "function") {
    callbacks.onStatus(status);
  }
  if (typeof callbacks.onUiStatus === "function") {
    callbacks.onUiStatus(status);
  }
}

/**
 * @param {import('../VoiceAgentProvider.js').VoiceAgentStartContext} _context
 * @returns {Promise<never>}
 */
async function start(_context) {
  emitStatus(_context, VOICE_AGENT_STATES.ERROR);
  throw new Error(
    "OpenAI Realtime aún no implementado. Usa VOICE_AGENT_PROVIDER=elevenlabs."
  );
}

async function stop() {
  // no-op
}

function mute() {
  // no-op
}

function unmute() {
  // no-op
}

/**
 * @param {number} _value
 */
function setVolume(_value) {
  // no-op
}

function isActive() {
  return false;
}

function getConversationId() {
  return null;
}

function isSupported() {
  return false;
}

/** @type {import('../VoiceAgentProvider.js').VoiceAgentProvider} */
const OpenAIRealtimeProvider = {
  start,
  stop,
  mute,
  unmute,
  setVolume,
  isActive,
  getConversationId,
  isSupported,
};

export default OpenAIRealtimeProvider;
