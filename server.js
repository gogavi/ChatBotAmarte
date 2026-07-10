// Carga variables de entorno desde el archivo .env antes de leer process.env
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { OpenAI, toFile } = require("openai");
const { buildMartinaSystemPrompt } = require("./config/martinaSystemPrompt");
const { matchSuiteFromPageUrl } = require("./config/suitePageHints");
const {
  MARTINA_REPLY_JSON_SCHEMA,
  buildAssistantResponse,
  stripOptionsBlock,
  resolveChatActions,
} = require("./config/chatActions");
const conversationStore = require("./conversationStore");
const { normalizeAssistantPaymentLinks } = require("./paymentLinks");
const { normalizeTextForTts } = require("./ttsNormalize");
const {
  createPendingReservation,
} = require("./reservationService");

const PORT = process.env.PORT || 3000;
const app = express();

const ELEVENLABS_VOICE_ID_DEFAULT = "VmejBeYhbrcTPwDniox7";
/** Máx. caracteres enviados a ElevenLabs por respuesta (evita payloads enormes). */
const TTS_MAX_CHARS = 2500;

/** UUID v4 — identificador de conversación enviado por el widget. */
const CONVERSATION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Upload de audio: límite alineado con Whisper (25 MB). El widget corta grabación ~120 s. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(express.json());

app.use(
  cors({
    origin: ["https://amartesuite.com", "https://www.amartesuite.com"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(
  express.static("public", {
    setHeaders(res, filePath) {
      if (filePath.endsWith("amarte-widget.js")) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "amarte-chatbot",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
    chatHistoryEnabled: Boolean(getChatHistoryStore()),
    supabaseConfigured: Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  });
});

app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Amarte Chatbot</title>
</head>
<body style="font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.5;">
  <h1>Amarte Chatbot</h1>
  <p>Backend activo. Endpoints: <code>/chat</code>, <code>/chat/audio</code>, <code>/health</code>.</p>
  <p>Widget: <a href="/amarte-widget.js">/amarte-widget.js</a> · Demo: <a href="/embed-demo.html">/embed-demo.html</a></p>
  <h2>Embed en amartesuite.com</h2>
  <pre style="background:#f4f4f4;padding:1rem;overflow:auto;border-radius:8px;"><code>&lt;script&gt;
  window.AMARTE_CHATBOT_URL = "https://chatbotamarte-production.up.railway.app";
&lt;/script&gt;
&lt;script src="https://chatbotamarte-production.up.railway.app/amarte-widget.js?v=690f9f4"&gt;&lt;/script&gt;</code></pre>
</body>
</html>`);
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let chatHistoryStore = null;

function enableChatHistoryStore(reason) {
  try {
    conversationStore.initConversationStore();
    chatHistoryStore = conversationStore;
    console.log(
      `Historial de chat: Supabase (chatbot_conversations / chatbot_messages)${reason ? ` [${reason}]` : ""}`
    );
    return true;
  } catch (e) {
    chatHistoryStore = null;
    console.warn("Historial de chat deshabilitado:", e.message);
    return false;
  }
}

enableChatHistoryStore("startup");

/**
 * Asegura store de historial antes de leer/escribir (reintento lazy).
 */
function getChatHistoryStore() {
  if (chatHistoryStore && conversationStore.isStoreReady()) {
    return chatHistoryStore;
  }
  if (conversationStore.ensureStoreReady()) {
    chatHistoryStore = conversationStore;
    console.log("Historial de chat: Supabase habilitado (lazy)");
    return chatHistoryStore;
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function sanitizeConversationId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const t = value.trim();
  if (t.length > 64 || !CONVERSATION_ID_RE.test(t)) {
    return null;
  }
  return t;
}

function sanitizeReferenceDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return "";
  }
  return value.trim();
}

function sanitizeReferenceTime(value) {
  if (typeof value !== "string" || !/^\d{1,2}:\d{2}$/.test(value.trim())) {
    return "";
  }
  const t = value.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const hh = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, "0");
  const mm = String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, "0");
  return `${hh}:${mm}`;
}

function sanitizeReferenceWeekday(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, 48);
}

function sanitizeReferenceIso(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, 120);
}

/**
 * @param {Record<string, unknown>} body
 */
function extractTemporalContext(body) {
  return {
    referenceDate: sanitizeReferenceDate(body.referenceDate),
    referenceTime: sanitizeReferenceTime(body.referenceTime),
    referenceWeekday: sanitizeReferenceWeekday(body.referenceWeekday),
    referenceIso: sanitizeReferenceIso(body.referenceIso),
  };
}

/**
 * Limpia contenido de historial (legado [OPTIONS] + Wompi corrupto) antes de reenviarlo al modelo.
 * @param {string} content
 */
function sanitizeHistoryContent(content) {
  return stripOptionsBlock(normalizeAssistantPaymentLinks(content));
}

/**
 * Núcleo del chat Martina (texto + opciones + texto para historial).
 * @param {{
 *   message: string;
 *   roomName: string;
 *   pageUrl: string;
 *   conversationId?: string | null;
 *   priorMessages?: Array<{ role: string; content: string }>;
 *   referenceDate?: string;
 *   referenceTime?: string;
 *   referenceWeekday?: string;
 *   referenceIso?: string;
 * }} input
 * @returns {Promise<{
 *   reply: string;
 *   options: Array<{label:string;url:string}>;
 *   rawText: string;
 *   reservationId?: string | null;
 * }>}
 */
async function runChat(input) {
  const message = input.message.trim();
  const safeRoom =
    typeof input.roomName === "string" && input.roomName.trim()
      ? input.roomName.trim()
      : "sin especificar";
  const safePage =
    typeof input.pageUrl === "string" && input.pageUrl.trim()
      ? input.pageUrl.trim()
      : "sin especificar";
  const conversationId =
    typeof input.conversationId === "string" ? input.conversationId : null;

  const suiteMatch = matchSuiteFromPageUrl(safePage);

  const systemPrompt = buildMartinaSystemPrompt({
    roomName: safeRoom,
    pageUrl: safePage,
    referenceDate: input.referenceDate || "",
    referenceTime: input.referenceTime || "",
    referenceWeekday: input.referenceWeekday || "",
    referenceIso: input.referenceIso || "",
    detectedSuiteLabel: suiteMatch ? suiteMatch.detectedSuiteLabel : null,
    detectedSuiteUrl: suiteMatch ? suiteMatch.detectedSuiteUrl : null,
  });

  const prior = Array.isArray(input.priorMessages) ? input.priorMessages : [];
  const historyForApi = prior
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .map((m) => ({
      role: m.role,
      content: sanitizeHistoryContent(m.content),
    }));

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    messages: [
      { role: "system", content: systemPrompt },
      ...historyForApi,
      { role: "user", content: message },
    ],
    response_format: {
      type: "json_schema",
      json_schema: MARTINA_REPLY_JSON_SCHEMA,
    },
  });

  const modelContent = completion.choices[0]?.message?.content ?? "";
  const built = buildAssistantResponse(modelContent);
  let reply = normalizeAssistantPaymentLinks(built.reply);
  let options = built.options;
  let reservationId = null;

  const histForLink = getChatHistoryStore();
  const existingReservationId =
    conversationId && histForLink
      ? await histForLink.getLinkedReservationId(conversationId)
      : null;

  if (
    built.pendingReservation &&
    !existingReservationId &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    const created = await createPendingReservation(built.pendingReservation, {
      conversationId,
    });
    if (created.ok) {
      reservationId = created.id;
      if (conversationId && histForLink) {
        await histForLink.linkReservation(conversationId, created.id);
      }
      const confirmLine = `\n\n✅ Dejé tu prerreserva pendiente de pago en nuestro sistema (**${created.row.tipo}**, ${created.row.fecha_reserva} ${created.row.hora_reserva}, ${created.row.pack_tiempo}). Un asesor la verá en el panel. Puedes abonar con Wompi o continuar por WhatsApp.`;
      if (!reply.includes("prerreserva")) {
        reply = `${reply.trim()}${confirmLine}`;
      }
      options = resolveChatActions(["wompi", "whatsapp"]);
      console.log(`Prerreserva creada: ${created.id} (${created.row.tipo})`);
    } else {
      console.warn("No se creó prerreserva:", created.error);
      reply = `${reply.trim()}\n\nAún no pude registrar la prerreserva automáticamente (${created.error}). Puedes usar el formulario o WhatsApp y un asesor te ayuda.`;
      options = resolveChatActions(["reserve", "whatsapp", "wompi"]);
    }
  } else if (built.pendingReservation && existingReservationId) {
    console.log(
      `Prerreserva omitida: ya existe ${existingReservationId} para ${conversationId}`
    );
  }

  // Historial: solo el texto visible (sin JSON ni URLs de botones).
  const rawText = reply;
  console.log(
    `IA respondió a ${safeRoom}: ${options.length} botones (${built.actionTypes.join(", ")}).`
  );
  return { reply, options, rawText, reservationId };
}

/**
 * Quita Markdown ligero antes de TTS (evita leer asteriscos o sintaxis de enlaces).
 * @param {string} text
 */
function stripMarkdownForTts(text) {
  if (!text || typeof text !== "string") {
    return "";
  }
  let s = text;
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/_([^_\n]+)_/g, "$1");
  return s.trim();
}

/**
 * Sintetiza voz con ElevenLabs (voz Lina por defecto).
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
async function synthesizeElevenLabs(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY no configurada");
  }
  const voiceId =
    process.env.ELEVENLABS_VOICE_ID || ELEVENLABS_VOICE_ID_DEFAULT;
  const stripped = normalizeTextForTts(stripMarkdownForTts(text));
  const safeText =
    stripped.length > TTS_MAX_CHARS
      ? stripped.slice(0, TTS_MAX_CHARS)
      : stripped;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: safeText,
      model_id: "eleven_multilingual_v2",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `ElevenLabs ${res.status}: ${errText.slice(0, 200)}`
    );
  }

  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// POST /chat — solo texto, sin audio de respuesta
app.post("/chat", async (req, res) => {
  try {
    const body = req.body || {};
    const { message, roomName, pageUrl, conversationId: rawConvId } = body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "El campo message es obligatorio" });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "El servidor no está configurado correctamente" });
    }
    const conversationId = sanitizeConversationId(rawConvId);
    const histStore = getChatHistoryStore();
    const priorMessages =
      conversationId && histStore
        ? await histStore.getPriorMessages(conversationId)
        : [];
    if (conversationId) {
      console.log(
        `Historial ${conversationId.slice(0, 8)}…: ${priorMessages.length} msgs (store=${Boolean(histStore)})`
      );
    }

    const temporal = extractTemporalContext(body);

    const result = await runChat({
      message,
      roomName,
      pageUrl,
      conversationId,
      priorMessages,
      ...temporal,
    });

    if (conversationId && histStore) {
      const assistantToStore =
        typeof result.rawText === "string" && result.rawText.trim()
          ? result.rawText
          : result.reply || "";
      try {
        await histStore.appendTurn(
          conversationId,
          message.trim(),
          assistantToStore,
          { pageUrl, roomName }
        );
      } catch (histErr) {
        console.warn("appendTurn:", histErr.message || histErr);
      }
    }

    return res.json({
      reply: result.reply,
      options: result.options,
      ...(result.reservationId ? { reservationId: result.reservationId } : {}),
    });
  } catch (err) {
    console.error("Error en /chat:", err);
    return res.status(500).json({ error: "No se pudo procesar la conversación" });
  }
});

// POST /chat/audio — audio del usuario: Whisper → chat → ElevenLabs
app.post(
  "/chat/audio",
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "El servidor no está configurado correctamente" });
      }
      const file = req.file;
      if (!file || !file.buffer) {
        return res.status(400).json({ error: "Se requiere un archivo de audio (campo audio)" });
      }

      const roomName =
        typeof req.body.roomName === "string" ? req.body.roomName : "";
      const pageUrl =
        typeof req.body.pageUrl === "string" ? req.body.pageUrl : "";
      const conversationId = sanitizeConversationId(req.body.conversationId);

      const audioFile = await toFile(
        file.buffer,
        file.originalname || "audio.webm",
        { type: file.mimetype || "audio/webm" }
      );

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "gpt-4o-mini-transcribe",
        language: "es",
      });

      const transcript =
        typeof transcription.text === "string" ? transcription.text.trim() : "";
      if (!transcript) {
        return res.status(400).json({
          error: "No se pudo transcribir el audio. Intente de nuevo.",
          transcript: "",
        });
      }

      const histStoreAudio = getChatHistoryStore();
      const priorMessages =
        conversationId && histStoreAudio
          ? await histStoreAudio.getPriorMessages(conversationId)
          : [];

      const temporal = extractTemporalContext(req.body || {});

      const { reply, options, rawText, reservationId } = await runChat({
        message: transcript,
        roomName,
        pageUrl,
        conversationId,
        priorMessages,
        ...temporal,
      });

      if (conversationId && histStoreAudio) {
        const assistantToStore =
          typeof rawText === "string" && rawText.trim()
            ? rawText
            : reply || "";
        try {
          await histStoreAudio.appendTurn(
            conversationId,
            transcript,
            assistantToStore,
            { pageUrl, roomName }
          );
        } catch (histErr) {
          console.warn("appendTurn:", histErr.message || histErr);
        }
      }

      let audioBase64 = null;
      let audioMimeType = "audio/mpeg";
      /** @type {"ok"|"missing_api_key"|"error"} */
      let ttsStatus = "missing_api_key";

      if (process.env.ELEVENLABS_API_KEY) {
        try {
          const audioBuf = await synthesizeElevenLabs(reply);
          audioBase64 = audioBuf.toString("base64");
          ttsStatus = "ok";
        } catch (ttsErr) {
          console.error("ElevenLabs TTS:", ttsErr);
          ttsStatus = "error";
        }
      } else {
        console.warn("ELEVENLABS_API_KEY ausente: respuesta sin audio");
      }

      return res.json({
        reply,
        options,
        transcript,
        ttsStatus,
        ...(reservationId ? { reservationId } : {}),
        ...(audioBase64
          ? { audioBase64, audioMimeType }
          : {}),
      });
    } catch (err) {
      console.error("Error en /chat/audio:", err);
      return res.status(500).json({ error: "No se pudo procesar el audio" });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Servidor Amarte escuchando en http://localhost:${PORT}`);
});
