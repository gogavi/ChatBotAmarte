/**
 * Entry del bundle de voz en vivo (esbuild IIFE).
 * Expone window.VoiceAgentManager; alias AmarteLiveAgent por compatibilidad.
 */

import VoiceAgentManager from "./VoiceAgentManager.js";

export default VoiceAgentManager;

if (typeof window !== "undefined") {
  window.VoiceAgentManager = VoiceAgentManager;
  // Alias temporal para embeds en caché que aún referencian AmarteLiveAgent.
  window.AmarteLiveAgent = VoiceAgentManager;
}
