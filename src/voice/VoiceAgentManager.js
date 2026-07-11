/**
 * Fachada pública del agente de voz.
 * El widget solo debe usar VoiceAgentManager — nunca SDKs de proveedores.
 */

import ElevenLabsProvider from "./providers/ElevenLabsProvider.js";
import OpenAIRealtimeProvider from "./providers/OpenAIRealtimeProvider.js";
import { VOICE_AGENT_STATES } from "./states.js";

/** @type {import('./VoiceAgentProvider.js').VoiceAgentProvider | null} */
let activeProvider = null;

/** @type {string} */
let activeProviderName = "elevenlabs";

/**
 * @param {string} [name]
 * @returns {import('./VoiceAgentProvider.js').VoiceAgentProvider}
 */
function createProvider(name) {
  const key = String(name || "elevenlabs").trim().toLowerCase();
  if (key === "openai") {
    return OpenAIRealtimeProvider;
  }
  return ElevenLabsProvider;
}

/**
 * @param {import('./VoiceAgentProvider.js').VoiceAgentStartContext} options
 */
async function start(options) {
  if (activeProvider && activeProvider.isActive()) {
    throw new Error("Ya hay una sesión de voz en vivo activa");
  }
  const providerName = String(options.provider || "elevenlabs")
    .trim()
    .toLowerCase();
  activeProviderName = providerName === "openai" ? "openai" : "elevenlabs";
  activeProvider = createProvider(activeProviderName);
  return activeProvider.start(options);
}

async function stop() {
  if (!activeProvider) return;
  const provider = activeProvider;
  activeProvider = null;
  await provider.stop();
}

function mute() {
  if (activeProvider) activeProvider.mute();
}

function unmute() {
  if (activeProvider) activeProvider.unmute();
}

/**
 * @param {number} value
 */
function setVolume(value) {
  if (activeProvider) activeProvider.setVolume(value);
}

function isActive() {
  return Boolean(activeProvider && activeProvider.isActive());
}

function getConversationId() {
  if (activeProvider && typeof activeProvider.getConversationId === "function") {
    return activeProvider.getConversationId();
  }
  return null;
}

function isSupported() {
  const provider = activeProvider || createProvider(activeProviderName);
  if (typeof provider.isSupported === "function") {
    return provider.isSupported();
  }
  return true;
}

/** Alias histórico usado por el widget antes de la abstracción. */
function isWebRtcSupported() {
  return isSupported();
}

function getActiveProviderName() {
  return activeProviderName;
}

/** @type {import('./VoiceAgentProvider.js').VoiceAgentProvider & {
 *   createProvider: typeof createProvider;
 *   isWebRtcSupported: typeof isWebRtcSupported;
 *   getActiveProviderName: typeof getActiveProviderName;
 *   STATES: typeof VOICE_AGENT_STATES;
 * }} */
const VoiceAgentManager = {
  start,
  stop,
  mute,
  unmute,
  setVolume,
  isActive,
  getConversationId,
  isSupported,
  isWebRtcSupported,
  createProvider,
  getActiveProviderName,
  STATES: VOICE_AGENT_STATES,
};

export default VoiceAgentManager;
