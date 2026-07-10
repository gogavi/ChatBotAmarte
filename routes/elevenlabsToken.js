const express = require("express");
const rateLimit = require("express-rate-limit");
const { matchSuiteFromPageUrl } = require("../config/suitePageHints");
const {
  TOKEN_RATE_LIMIT,
  ELEVENLABS_FETCH_TIMEOUT_MS,
  isLiveVoiceEnabled,
  isElevenLabsAgentConfigured,
  getElevenLabsEnvironment,
} = require("../liveVoiceConfig");
const { getBogotaReference } = require("../services/bogotaTime");
const {
  sanitizeConversationId,
  validatePageUrl,
  sanitizeRoomName,
} = require("../services/liveVoiceValidation");

const router = express.Router();

const tokenLimiter = rateLimit({
  windowMs: TOKEN_RATE_LIMIT.windowMs,
  max: TOKEN_RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiadas solicitudes de conversación en vivo. Intenta más tarde.",
  },
});

/**
 * Solicita token WebRTC a ElevenLabs.
 * @param {{ agentId: string; environment: string; participantName: string; apiKey: string }} opts
 */
async function fetchConversationToken(opts) {
  const url = new URL(
    "https://api.elevenlabs.io/v1/convai/conversation/token"
  );
  url.searchParams.set("agent_id", opts.agentId);
  url.searchParams.set("environment", opts.environment);
  url.searchParams.set("participant_name", opts.participantName);

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    ELEVENLABS_FETCH_TIMEOUT_MS
  );
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "xi-api-key": opts.apiKey,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const err = new Error(
        `ElevenLabs token HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`
      );
      err.status = response.status;
      throw err;
    }
    const body = await response.json();
    const token =
      (body && (body.token || body.conversation_token || body.conversationToken)) ||
      null;
    if (!token || typeof token !== "string") {
      throw new Error("Respuesta de token inválida");
    }
    return token;
  } finally {
    clearTimeout(timer);
  }
}

router.post(
  "/elevenlabs/conversation-token",
  tokenLimiter,
  async (req, res) => {
    if (!isLiveVoiceEnabled() || !isElevenLabsAgentConfigured()) {
      return res.status(503).json({
        error: "Conversación en vivo no disponible",
      });
    }

    const conversationId = sanitizeConversationId(req.body?.conversationId);
    if (!conversationId) {
      return res.status(400).json({ error: "conversationId inválido" });
    }

    const pageCheck = validatePageUrl(req.body?.pageUrl);
    if (!pageCheck.ok) {
      return res.status(400).json({ error: pageCheck.error });
    }

    // roomName se acepta pero no se usa para lógica comercial
    sanitizeRoomName(req.body?.roomName);

    const suiteMatch = matchSuiteFromPageUrl(pageCheck.pageUrl);
    const suiteContext = suiteMatch
      ? suiteMatch.detectedSuiteLabel || ""
      : "";

    const bogota = getBogotaReference();

    try {
      const conversationToken = await fetchConversationToken({
        agentId: process.env.ELEVENLABS_AGENT_ID,
        environment: getElevenLabsEnvironment(),
        participantName: conversationId,
        apiKey: process.env.ELEVENLABS_API_KEY,
      });

      return res.json({
        conversationToken,
        context: {
          conversationId,
          suiteContext,
          pagePath: pageCheck.pagePath,
          referenceDate: bogota.referenceDate,
          referenceTime: bogota.referenceTime,
          referenceWeekday: bogota.referenceWeekday,
          source: "amarte_website",
        },
      });
    } catch (err) {
      const aborted = err && err.name === "AbortError";
      console.error(
        "conversation-token:",
        aborted ? "timeout" : err.message || err
      );
      return res.status(502).json({
        error: "No se pudo obtener el token de conversación",
      });
    }
  }
);

module.exports = router;
module.exports.fetchConversationToken = fetchConversationToken;
module.exports.tokenLimiter = tokenLimiter;
