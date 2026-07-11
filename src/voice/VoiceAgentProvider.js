/**
 * Contrato VoiceAgentProvider — interfaz intercambiable para agentes de voz.
 *
 * Implementaciones:
 * - ElevenLabsProvider (activa)
 * - OpenAIRealtimeProvider (stub / extensión futura)
 *
 * El widget NUNCA debe importar SDKs de proveedores ni llamar a
 * Conversation.startSession. Solo usa VoiceAgentManager.
 *
 * @typedef {import('./states.js').VoiceAgentState} VoiceAgentState
 *
 * @typedef {{
 *   backendUrl: string;
 *   conversationId: string;
 *   pageUrl: string;
 *   roomName?: string;
 *   provider?: string;
 *   onStatus?: (status: VoiceAgentState) => void;
 *   onUiStatus?: (status: VoiceAgentState) => void;
 *   onTranscript?: (payload: { role: string; text: string }) => void;
 *   onShowActions?: (actions: string[]) => void;
 *   onError?: (message: string, context?: unknown) => void;
 *   onConnected?: (info: { conversationId: string }) => void;
 *   onDisconnected?: (details: unknown) => void;
 * }} VoiceAgentStartContext
 *
 * @typedef {{
 *   start: (context: VoiceAgentStartContext) => Promise<unknown>;
 *   stop: () => Promise<void> | void;
 *   mute: () => void;
 *   unmute: () => void;
 *   setVolume: (value: number) => void;
 *   isActive: () => boolean;
 *   getConversationId?: () => string | null;
 *   isSupported?: () => boolean;
 * }} VoiceAgentProvider
 */

export {};
