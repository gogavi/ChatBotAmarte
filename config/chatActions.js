const { contact, payment } = require("./amarteCatalog");

/** @typedef {"reserve" | "promotions" | "wompi" | "whatsapp"} ChatActionType */
/** @typedef {{ label: string; url: string }} ChatOption */

/** @type {readonly ChatActionType[]} */
const CHAT_ACTION_TYPES = Object.freeze([
  "reserve",
  "promotions",
  "wompi",
  "whatsapp",
]);

/** @type {Readonly<Record<ChatActionType, ChatOption>>} */
const CHAT_ACTIONS = Object.freeze({
  reserve: {
    label: "📅 Reservar ahora",
    url: contact.reservationsUrl,
  },
  promotions: {
    label: "🎁 PROMOCIONES",
    url: contact.promotionsUrl,
  },
  wompi: {
    label: "💳 Pago seguro Wompi",
    url: payment.checkoutUrl,
  },
  whatsapp: {
    label: "💬 WhatsApp",
    url: contact.whatsappUrl,
  },
});

/** @type {readonly ChatActionType[]} */
const DEFAULT_ACTION_TYPES = CHAT_ACTION_TYPES;

const ACTION_TYPE_SET = new Set(CHAT_ACTION_TYPES);

/**
 * Schema JSON estricto para Chat Completions (Structured Outputs).
 * El modelo solo elige tipos; el servidor resuelve label + URL.
 */
const MARTINA_REPLY_JSON_SCHEMA = {
  name: "martina_reply",
  strict: true,
  schema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description:
          "Texto visible para el usuario (Markdown ligero permitido). Sin URLs de Wompi, reservas, promociones ni WhatsApp.",
      },
      actionTypes: {
        type: "array",
        description:
          "Tipos de botones a mostrar. El servidor añade las URLs canónicas.",
        items: {
          type: "string",
          enum: [...CHAT_ACTION_TYPES],
        },
      },
    },
    required: ["message", "actionTypes"],
    additionalProperties: false,
  },
};

/**
 * @param {unknown} actionTypes
 * @returns {ChatOption[]}
 */
function resolveChatActions(actionTypes) {
  const requested = Array.isArray(actionTypes) ? actionTypes : [];
  /** @type {ChatActionType[]} */
  const types = [];
  const seen = new Set();

  for (const raw of requested) {
    if (typeof raw !== "string" || !ACTION_TYPE_SET.has(raw) || seen.has(raw)) {
      continue;
    }
    /** @type {ChatActionType} */
    const type = /** @type {ChatActionType} */ (raw);
    seen.add(type);
    types.push(type);
  }

  const finalTypes = types.length > 0 ? types : [...DEFAULT_ACTION_TYPES];
  return finalTypes.map((type) => {
    const action = CHAT_ACTIONS[type];
    return { label: action.label, url: action.url };
  });
}

/**
 * Quita el bloque legado [OPTIONS]...[/OPTIONS] del texto del asistente.
 * @param {string} text
 */
function stripOptionsBlock(text) {
  if (!text || typeof text !== "string") {
    return "";
  }
  const startTag = "[OPTIONS]";
  const endTag = "[/OPTIONS]";
  const startIdx = text.indexOf(startTag);
  const endIdx = text.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return text.trim();
  }
  return text.slice(0, startIdx).trim();
}

/**
 * @param {string} content
 * @returns {{ message: string; actionTypes: unknown } | null}
 */
function tryParseStructuredMartinaReply(content) {
  if (!content || typeof content !== "string") {
    return null;
  }
  let raw = content.trim();
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence) {
    raw = fence[1].trim();
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    if (typeof parsed.message !== "string") {
      return null;
    }
    return {
      message: parsed.message,
      actionTypes: parsed.actionTypes,
    };
  } catch {
    return null;
  }
}

/**
 * Compatibilidad con respuestas antiguas que aún traen [OPTIONS].
 * @param {string} rawText
 * @returns {{ reply: string; optionsFromLegacy: Array<{ label: string; url: string }> | null }}
 */
function parseLegacyOptionsReply(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { reply: "", optionsFromLegacy: null };
  }
  const startTag = "[OPTIONS]";
  const endTag = "[/OPTIONS]";
  const startIdx = rawText.indexOf(startTag);
  const endIdx = rawText.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { reply: rawText.trim(), optionsFromLegacy: null };
  }
  const reply = rawText.slice(0, startIdx).trim();
  const jsonSlice = rawText.slice(startIdx + startTag.length, endIdx).trim();
  try {
    const parsed = JSON.parse(jsonSlice);
    if (!Array.isArray(parsed)) {
      return { reply: reply || rawText.trim(), optionsFromLegacy: null };
    }
    const options = parsed
      .filter(
        (item) =>
          item &&
          typeof item.label === "string" &&
          typeof item.url === "string"
      )
      .map((item) => ({ label: item.label, url: item.url }));
    return {
      reply: reply || rawText.trim(),
      optionsFromLegacy: options.length ? options : null,
    };
  } catch {
    return { reply: reply || rawText.trim(), optionsFromLegacy: null };
  }
}

/**
 * Interpreta la salida del modelo y siempre devuelve botones con URLs del catálogo.
 * @param {string} modelContent
 * @returns {{ reply: string; options: ChatOption[]; actionTypes: ChatActionType[] }}
 */
function buildAssistantResponse(modelContent) {
  const structured = tryParseStructuredMartinaReply(modelContent);
  if (structured) {
    const options = resolveChatActions(structured.actionTypes);
    const actionTypes =
      Array.isArray(structured.actionTypes) && structured.actionTypes.length
        ? /** @type {ChatActionType[]} */ (
            structured.actionTypes.filter((t) => ACTION_TYPE_SET.has(t))
          )
        : [...DEFAULT_ACTION_TYPES];
    return {
      reply: stripOptionsBlock(structured.message),
      options,
      actionTypes: actionTypes.length ? actionTypes : [...DEFAULT_ACTION_TYPES],
    };
  }

  const legacy = parseLegacyOptionsReply(modelContent);
  // Ignoramos URLs del legado: el servidor siempre usa el catálogo.
  const options = resolveChatActions(DEFAULT_ACTION_TYPES);
  return {
    reply: legacy.reply,
    options,
    actionTypes: [...DEFAULT_ACTION_TYPES],
  };
}

module.exports = {
  CHAT_ACTION_TYPES,
  CHAT_ACTIONS,
  DEFAULT_ACTION_TYPES,
  MARTINA_REPLY_JSON_SCHEMA,
  resolveChatActions,
  stripOptionsBlock,
  tryParseStructuredMartinaReply,
  parseLegacyOptionsReply,
  buildAssistantResponse,
};
