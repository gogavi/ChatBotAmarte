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
const { isSupabaseConfigured } = require("./supabaseClient");
const { normalizeAssistantPaymentLinks } = require("./paymentLinks");
const { normalizeTextForTts } = require("./ttsNormalize");
const {
  createPendingReservation,
  buildPrereservaConfirmMessage,
} = require("./reservationService");
const { enrichChatReply } = require("./services/suiteChatEnrichment");
const {
  isLiveVoiceEnabled,
  isElevenLabsAgentConfigured,
} = require("./liveVoiceConfig");
const widgetConfigRouter = require("./routes/widgetConfig");
const elevenlabsTokenRouter = require("./routes/elevenlabsToken");
const agentToolsRouter = require("./routes/agentTools");
const elevenlabsPostCallRouter = require("./routes/elevenlabsPostCall");

const PORT = process.env.PORT || 3000;
const app = express();
// Railway / proxies envían X-Forwarded-For; necesario para express-rate-limit.
app.set("trust proxy", 1);

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

const corsOrigins = [
  "https://amartesuite.com",
  "https://www.amartesuite.com",
  // Front Vite (rediseño) y demos locales — también en producción Railway
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];
const extraCorsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
extraCorsOrigins.forEach((origin) => {
  if (!corsOrigins.includes(origin)) corsOrigins.push(origin);
});

/**
 * Permite orígenes locales (cualquier puerto) y previews de Vercel,
 * además de la lista fija / CORS_ORIGINS.
 * Sin esto, localhost:3001 o *.vercel.app fallan en el widget con
 * "problema al conectar con el concierge".
 */
function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (corsOrigins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (hostname.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Webhook post-call: cuerpo crudo ANTES de express.json()
app.use("/api", elevenlabsPostCallRouter);

app.use(express.json({ limit: "256kb" }));

app.use(
  express.static("public", {
    setHeaders(res, filePath) {
      if (
        filePath.endsWith("amarte-widget.js") ||
        filePath.endsWith("amarte-live-agent.bundle.js")
      ) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  })
);

app.use("/api", widgetConfigRouter);
app.use("/api", elevenlabsTokenRouter);
app.use("/api/agent-tools", agentToolsRouter);

app.get("/health", (_req, res) => {
  const histStore = getChatHistoryStore();
  const persist = conversationStore.isSupabasePersistenceEnabled();
  const initError = conversationStore.getLastInitError();
  res.json({
    ok: true,
    service: "amarte-chatbot",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
    elevenLabsAgentConfigured: isElevenLabsAgentConfigured(),
    liveVoiceEnabled: isLiveVoiceEnabled(),
    chatHistoryEnabled: Boolean(histStore && conversationStore.isStoreReady()),
    supabaseConfigured: isSupabaseConfigured(),
    supabasePersistenceEnabled: persist,
    chatHistoryInitError: persist ? null : initError,
    chatHistoryMetrics: conversationStore.getHistoryMetrics(),
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
  <p>Backend activo. Endpoints: <code>/chat</code>, <code>/chat/history</code>, <code>/chat/audio</code>, <code>/api/widget-config</code>, <code>/health</code>.</p>
  <p>Widget: <a href="/amarte-widget.js">/amarte-widget.js</a> · Live: <a href="/amarte-live-agent.bundle.js">/amarte-live-agent.bundle.js</a> · Demo: <a href="/embed-demo.html">/embed-demo.html</a></p>
  <h2>Embed en amartesuite.com</h2>
  <pre style="background:#f4f4f4;padding:1rem;overflow:auto;border-radius:8px;"><code>&lt;script&gt;
  window.AMARTE_CHATBOT_URL = "https://chatbotamarte-production.up.railway.app";
&lt;/script&gt;
&lt;script src="https://chatbotamarte-production.up.railway.app/amarte-widget.js?v=20260724"&gt;&lt;/script&gt;</code></pre>
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
    const persist = conversationStore.isSupabasePersistenceEnabled();
    console.log(
      `Historial de chat: memoria=on supabase=${persist ? "on" : "off"}${reason ? ` [${reason}]` : ""}`
    );
    if (!persist) {
      console.warn(
        "Historial: sin persistencia Supabase:",
        conversationStore.getLastInitError() || "desconocido"
      );
    }
    return true;
  } catch (e) {
    // Memoria debe seguir disponible; reintento mínimo
    try {
      conversationStore.ensureStoreReady();
      chatHistoryStore = conversationStore;
    } catch {
      chatHistoryStore = null;
    }
    console.warn("Historial de chat: init parcial:", e.message);
    return Boolean(chatHistoryStore);
  }
}

enableChatHistoryStore("startup");

/**
 * Store de historial (memoria + Supabase opcional). Siempre intenta habilitar.
 */
function getChatHistoryStore() {
  if (chatHistoryStore && conversationStore.isStoreReady()) {
    return chatHistoryStore;
  }
  if (conversationStore.ensureStoreReady()) {
    chatHistoryStore = conversationStore;
    if (!conversationStore.isSupabasePersistenceEnabled()) {
      console.warn(
        "Historial: memoria activa sin Supabase:",
        conversationStore.getLastInitError() || "desconocido"
      );
    } else {
      console.log("Historial de chat: Supabase habilitado (lazy)");
    }
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
 *   showReservationForm: boolean;
 *   showDateTimePicker: boolean;
 *   formPrefill: Record<string, string> | null;
 *   suiteVideo: { id: string; title: string; videoUrl: string } | null;
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
  let showReservationForm = Boolean(built.showReservationForm);
  let showDateTimePicker = Boolean(built.showDateTimePicker);
  let formPrefill = built.formPrefill || null;
  let suiteVideo = null;

  const histForLink = getChatHistoryStore();
  const existingReservationId =
    conversationId && histForLink
      ? await histForLink.getLinkedReservationId(conversationId)
      : null;

  if (existingReservationId) {
    showReservationForm = false;
    showDateTimePicker = false;
    formPrefill = null;
  }

  if (
    !showReservationForm &&
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
      reply = buildPrereservaConfirmMessage(created.row);
      options = resolveChatActions(["wompi"]);
      showDateTimePicker = false;
      console.log(`Prerreserva creada: ${created.id} (${created.row.tipo})`);
    } else {
      console.warn("No se creó prerreserva:", created.error);
      reply = `${reply.trim()}\n\nAún no pude registrar la prerreserva automáticamente (${created.error}). Puedes usar Reservar o WhatsApp en el pie del chat y un asesor te ayuda.`;
      options = resolveChatActions(["wompi", "promotions"]);
      showDateTimePicker = false;
    }
  } else if (built.pendingReservation && existingReservationId) {
    console.log(
      `Prerreserva omitida: ya existe ${existingReservationId} para ${conversationId}`
    );
  }

  if (showReservationForm) {
    options = resolveChatActions(["promotions"]);
    showDateTimePicker = false;
  }

  // Video + sanitizar fichas web + anexar promo canónica si cotizó exacto
  const enriched = enrichChatReply(reply, built.suiteShowcase);
  reply = enriched.reply;
  suiteVideo = enriched.suiteVideo;

  // Historial: solo el texto visible (sin JSON ni URLs de botones).
  const rawText = reply;
  console.log(
    `IA respondió a ${safeRoom}: ${options.length} botones (${built.actionTypes.join(", ")})${showReservationForm ? " +form" : ""}${showDateTimePicker ? " +datepicker" : ""}${suiteVideo ? ` +video:${suiteVideo.id}` : ""}.`
  );
  return {
    reply,
    options,
    rawText,
    reservationId,
    showReservationForm,
    showDateTimePicker,
    formPrefill: showReservationForm ? formPrefill || {} : null,
    suiteVideo,
  };
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

/**
 * Formatea mensajes de historial para la UI del widget.
 * @param {Array<{ role: string; content: string }>} rows
 */
function formatHistoryForUi(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .map((m) => {
      if (m.role === "user") {
        return { role: "user", content: m.content, options: [] };
      }
      const built = buildAssistantResponse(m.content);
      const reply = normalizeAssistantPaymentLinks(
        stripOptionsBlock(built.reply || m.content)
      );
      // Quitar marcador interno de puente live en la UI
      const content = reply.replace(/^\[live:[^\]]+\]\s*/i, "").trim();
      return {
        role: "assistant",
        content: content || reply,
        options: Array.isArray(built.options) ? built.options : [],
      };
    });
}

// GET /chat/history — rehidratar panel del widget
app.get("/chat/history", async (req, res) => {
  try {
    const conversationId = sanitizeConversationId(req.query.conversationId);
    if (!conversationId) {
      return res.status(400).json({ error: "conversationId inválido", messages: [] });
    }
    const histStore = getChatHistoryStore();
    if (!histStore) {
      return res.json({ messages: [], historyEnabled: false });
    }
    const prior = await histStore.getPriorMessages(conversationId);
    return res.json({
      messages: formatHistoryForUi(prior),
      historyEnabled: true,
      supabasePersistenceEnabled:
        conversationStore.isSupabasePersistenceEnabled(),
    });
  } catch (err) {
    console.error("Error en /chat/history:", err);
    return res.status(500).json({ error: "No se pudo cargar el historial", messages: [] });
  }
});

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
    if (conversationId && !histStore) {
      console.warn(
        JSON.stringify({
          event: "history_store_unavailable",
          conversationId: conversationId.slice(0, 8),
          ts: new Date().toISOString(),
        })
      );
    }
    const priorMessages =
      conversationId && histStore
        ? await histStore.getPriorMessages(conversationId)
        : [];
    if (conversationId) {
      console.log(
        `Historial ${conversationId.slice(0, 8)}…: ${priorMessages.length} msgs (store=${Boolean(histStore)} persist=${conversationStore.isSupabasePersistenceEnabled()})`
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
        console.warn(
          JSON.stringify({
            event: "history_write_failed",
            conversationId: conversationId.slice(0, 8),
            message: histErr.message || String(histErr),
            ts: new Date().toISOString(),
          })
        );
      }
    }

    return res.json({
      reply: result.reply,
      options: result.options,
      ...(result.reservationId ? { reservationId: result.reservationId } : {}),
      showReservationForm: Boolean(result.showReservationForm),
      showDateTimePicker: Boolean(result.showDateTimePicker),
      formPrefill: result.showReservationForm
        ? result.formPrefill || {}
        : null,
      suiteVideo: result.suiteVideo || null,
    });
  } catch (err) {
    console.error("Error en /chat:", err);
    return res.status(500).json({ error: "No se pudo procesar la conversación" });
  }
});

/**
 * Crea prerreserva desde el formulario inline del widget.
 */
app.post("/reservations/pending", async (req, res) => {
  try {
    const body = req.body || {};
    const conversationId = sanitizeConversationId(body.conversationId);
    if (!conversationId) {
      return res.status(400).json({ ok: false, error: "conversationId inválido" });
    }

    const histStore = getChatHistoryStore();
    const existingReservationId = histStore
      ? await histStore.getLinkedReservationId(conversationId)
      : null;
    if (existingReservationId) {
      return res.status(409).json({
        ok: false,
        error: "Ya existe una prerreserva en esta conversación",
        reservationId: existingReservationId,
        reply:
          "Ya tienes una prerreserva registrada en esta conversación. Un asesor la verá en el panel; puedes abonar con Wompi o escribir por WhatsApp.",
        options: resolveChatActions(["wompi"]),
      });
    }

    const payload = {
      nombre: body.nombre,
      whatsapp: body.whatsapp,
      correo: body.correo || "",
      documento: body.documento || "",
      tipo: body.tipo,
      fecha_reserva: body.fecha_reserva,
      hora_reserva: body.hora_reserva,
      pack_tiempo: body.pack_tiempo,
      precio: body.precio,
      abono: body.abono || "",
    };

    const created = await createPendingReservation(payload, {
      conversationId,
    });
    if (!created.ok) {
      return res.status(400).json({
        ok: false,
        error: created.error,
        reply: `No pude registrar la prerreserva (${created.error}). Revisa los datos o usa Reservar / WhatsApp en el pie del chat.`,
        options: resolveChatActions(["wompi", "promotions"]),
      });
    }

    if (histStore) {
      await histStore.linkReservation(conversationId, created.id);
      try {
        const pageUrl =
          typeof body.pageUrl === "string" ? body.pageUrl : "";
        const roomName =
          typeof body.roomName === "string" ? body.roomName : "";
        await histStore.appendTurn(
          conversationId,
          "[Formulario de reserva enviado]",
          buildPrereservaConfirmMessage(created.row),
          { pageUrl, roomName }
        );
      } catch (histErr) {
        console.warn(
          "appendTurn form:",
          histErr && histErr.message ? histErr.message : histErr
        );
      }
    }

    const reply = buildPrereservaConfirmMessage(created.row);
    console.log(`Prerreserva (form): ${created.id} (${created.row.tipo})`);
    return res.json({
      ok: true,
      reservationId: created.id,
      reply,
      options: resolveChatActions(["wompi"]),
    });
  } catch (err) {
    console.error("Error en /reservations/pending:", err);
    return res.status(500).json({
      ok: false,
      error: "No se pudo crear la prerreserva",
    });
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

      const {
        reply,
        options,
        rawText,
        reservationId,
        showReservationForm,
        showDateTimePicker,
        formPrefill,
        suiteVideo,
      } = await runChat({
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
          console.warn(
            JSON.stringify({
              event: "history_write_failed",
              conversationId: conversationId.slice(0, 8),
              message: histErr.message || String(histErr),
              ts: new Date().toISOString(),
            })
          );
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
        showReservationForm: Boolean(showReservationForm),
        showDateTimePicker: Boolean(showDateTimePicker),
        formPrefill: showReservationForm ? formPrefill || {} : null,
        suiteVideo: suiteVideo || null,
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
