/**
 * Bundle cliente: integración ElevenLabs Agents (WebRTC) para Amarte.
 * Se expone como window.AmarteLiveAgent tras el build IIFE.
 */

import { Conversation } from "@elevenlabs/client";

/** Duración máxima de sesión en vivo (ms). */
const LIVE_MAX_SESSION_MS = 2 * 60 * 1000;

/** @type {ReturnType<typeof setTimeout> | null} */
let maxSessionTimer = null;

function clearMaxSessionTimer() {
  if (maxSessionTimer) {
    clearTimeout(maxSessionTimer);
    maxSessionTimer = null;
  }
}
/** @type {string | null} */
let activeLocalConversationId = null;
/** @type {boolean} */
let starting = false;

/**
 * @returns {boolean}
 */
function isWebRtcSupported() {
  try {
    return Boolean(
      typeof navigator !== "undefined" &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function" &&
        typeof window !== "undefined" &&
        (window.RTCPeerConnection ||
          window.webkitRTCPeerConnection ||
          window.mozRTCPeerConnection)
    );
  } catch {
    return false;
  }
}

/**
 * @param {object} callbacks
 * @param {string} status
 */
function emitStatus(callbacks, status) {
  if (callbacks && typeof callbacks.onUiStatus === "function") {
    callbacks.onUiStatus(status);
  }
}

/**
 * @param {{
 *   backendUrl: string;
 *   conversationId: string;
 *   pageUrl: string;
 *   roomName?: string;
 *   onUiStatus?: (status: string) => void;
 *   onTranscript?: (payload: { role: string; text: string }) => void;
 *   onShowActions?: (actions: string[]) => void;
 *   onError?: (message: string) => void;
 *   onConnected?: (info: { conversationId: string }) => void;
 *   onDisconnected?: (details: unknown) => void;
 * }} options
 */
async function start(options) {
  if (starting || activeConversation) {
    throw new Error("Ya hay una sesión de voz en vivo activa");
  }
  if (!isWebRtcSupported()) {
    throw new Error("Este navegador no soporta WebRTC");
  }

  const backendUrl = String(options.backendUrl || "").replace(/\/$/, "");
  if (!backendUrl) {
    throw new Error("backendUrl requerido");
  }

  starting = true;
  emitStatus(options, "connecting");

  try {
    const tokenRes = await fetch(
      `${backendUrl}/api/elevenlabs/conversation-token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: options.conversationId,
          pageUrl: options.pageUrl,
          roomName: options.roomName || "",
        }),
      }
    );

    if (!tokenRes.ok) {
      let msg = "No se pudo obtener el token de conversación";
      try {
        const errBody = await tokenRes.json();
        if (errBody && errBody.error) msg = String(errBody.error);
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    const tokenBody = await tokenRes.json();
    const conversationToken = tokenBody.conversationToken;
    const ctx = tokenBody.context || {};
    if (!conversationToken) {
      throw new Error("Token vacío");
    }

    activeLocalConversationId = options.conversationId;

    /** @type {Set<string>} */
    const seenMessages = new Set();

    const conversation = await Conversation.startSession({
      conversationToken,
      connectionType: "webrtc",
      dynamicVariables: {
        conversation_id: String(ctx.conversationId || options.conversationId),
        suite_context: String(ctx.suiteContext || ""),
        page_path: String(ctx.pagePath || ""),
        reference_date: String(ctx.referenceDate || ""),
        reference_time: String(ctx.referenceTime || ""),
        reference_weekday: String(ctx.referenceWeekday || ""),
        source: String(ctx.source || "amarte_website"),
      },
      clientTools: {
        show_action_buttons: (parameters) => {
          const actions = Array.isArray(parameters?.actions)
            ? parameters.actions.filter((a) => typeof a === "string")
            : [];
          if (typeof options.onShowActions === "function") {
            options.onShowActions(actions);
          }
          return "ok";
        },
      },
      onConnect: ({ conversationId }) => {
        emitStatus(options, "connected");
        if (typeof options.onConnected === "function") {
          options.onConnected({ conversationId });
        }
      },
      onDisconnect: (details) => {
        clearMaxSessionTimer();
        emitStatus(options, "disconnected");
        activeConversation = null;
        starting = false;
        if (typeof options.onDisconnected === "function") {
          options.onDisconnected(details);
        }
      },
      onError: (message, context) => {
        clearMaxSessionTimer();
        emitStatus(options, "error");
        if (typeof options.onError === "function") {
          options.onError(String(message || "Error de conversación"), context);
        }
      },
      onStatusChange: ({ status }) => {
        if (status === "connecting") emitStatus(options, "connecting");
        if (status === "connected") emitStatus(options, "connected");
        if (status === "disconnected") emitStatus(options, "disconnected");
      },
      onModeChange: ({ mode }) => {
        if (mode === "listening") emitStatus(options, "listening");
        if (mode === "speaking") emitStatus(options, "speaking");
      },
      onMessage: ({ message, role }) => {
        const text = typeof message === "string" ? message.trim() : "";
        if (!text) return;
        const key = `${role}:${text}`;
        if (seenMessages.has(key)) return;
        seenMessages.add(key);
        // Limitar tamaño del set
        if (seenMessages.size > 200) {
          const first = seenMessages.values().next().value;
          seenMessages.delete(first);
        }
        if (typeof options.onTranscript === "function") {
          options.onTranscript({
            role: role === "user" ? "user" : "agent",
            text,
          });
        }
      },
    });

    activeConversation = conversation;
    starting = false;
    clearMaxSessionTimer();
    maxSessionTimer = setTimeout(() => {
      maxSessionTimer = null;
      stop().catch(() => {});
    }, LIVE_MAX_SESSION_MS);
    return conversation;
  } catch (err) {
    clearMaxSessionTimer();
    starting = false;
    activeConversation = null;
    emitStatus(options, "error");
    throw err;
  }
}

async function stop() {
  clearMaxSessionTimer();
  const conv = activeConversation;
  activeConversation = null;
  starting = false;
  if (!conv) {
    return;
  }
  try {
    if (typeof conv.endSession === "function") {
      await conv.endSession();
    }
  } catch {
    // idempotente
  }
}

function mute() {
  if (activeConversation && typeof activeConversation.setMicMuted === "function") {
    activeConversation.setMicMuted(true);
  }
}

function unmute() {
  if (activeConversation && typeof activeConversation.setMicMuted === "function") {
    activeConversation.setMicMuted(false);
  }
}

/**
 * @param {number} volume
 */
function setVolume(volume) {
  if (activeConversation && typeof activeConversation.setVolume === "function") {
    activeConversation.setVolume({ volume });
  }
}

function isActive() {
  return Boolean(activeConversation);
}

function getConversationId() {
  if (activeConversation && typeof activeConversation.getId === "function") {
    return activeConversation.getId();
  }
  return activeLocalConversationId;
}

function cleanupOnUnload() {
  if (activeConversation) {
    stop();
  }
}

const AmarteLiveAgent = {
  start,
  stop,
  mute,
  unmute,
  setVolume,
  isActive,
  getConversationId,
  isWebRtcSupported,
};

export default AmarteLiveAgent;

if (typeof window !== "undefined") {
  if (typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", cleanupOnUnload);
    window.addEventListener("beforeunload", cleanupOnUnload);
  }
  window.AmarteLiveAgent = AmarteLiveAgent;
}
