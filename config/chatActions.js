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

/**
 * Todos los CTA viven en el pie del widget; el cuerpo del mensaje solo muestra video.
 * @type {ReadonlySet<ChatActionType>}
 */
const BODY_EXCLUDED_ACTION_TYPES = Object.freeze(
  new Set(/** @type {ChatActionType[]} */ ([...CHAT_ACTION_TYPES]))
);

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

/** Ya no hay botones CTA en el cuerpo del mensaje. */
/** @type {readonly ChatActionType[]} */
const DEFAULT_ACTION_TYPES = Object.freeze([]);

const ACTION_TYPE_SET = new Set(CHAT_ACTION_TYPES);

/**
 * Schema JSON estricto para Chat Completions (Structured Outputs).
 * El modelo solo elige tipos; el servidor resuelve label + URL.
 */
/** Campos de prerreserva (null = aún no crear en el SaaS). */
const PENDING_RESERVATION_SCHEMA = {
  anyOf: [
    { type: "null" },
    {
      type: "object",
      properties: {
        nombre: { type: "string" },
        whatsapp: { type: "string" },
        correo: { type: "string" },
        documento: { type: "string" },
        tipo: {
          type: "string",
          description:
            "Nombre exacto de suite/plan del catálogo SaaS, p.ej. Suite Diamante o Suite Jacuzzi",
        },
        fecha_reserva: {
          type: "string",
          description: "Fecha de ingreso YYYY-MM-DD (Bogotá)",
        },
        hora_reserva: {
          type: "string",
          description: "Hora de ingreso en 24h HH:MM, p.ej. 14:00",
        },
        pack_tiempo: {
          type: "string",
          description:
            "Pack 4 horas | Pack 6 horas | Pack 8 horas | Pack 12 horas | Día Hotelero",
        },
        precio: {
          type: "string",
          description: "Precio total cotizado en COP (solo dígitos o con formato)",
        },
        abono: {
          type: "string",
          description: "Abono sugerido (50%); vacío si el servidor debe calcularlo",
        },
      },
      required: [
        "nombre",
        "whatsapp",
        "correo",
        "documento",
        "tipo",
        "fecha_reserva",
        "hora_reserva",
        "pack_tiempo",
        "precio",
        "abono",
      ],
      additionalProperties: false,
    },
  ],
};

/** Prefill del formulario inline (null = no mostrar form). */
const FORM_PREFILL_SCHEMA = {
  anyOf: [
    { type: "null" },
    {
      type: "object",
      properties: {
        nombre: { type: "string" },
        whatsapp: { type: "string" },
        correo: { type: "string" },
        documento: { type: "string" },
        tipo: { type: "string" },
        fecha_reserva: {
          type: "string",
          description: "YYYY-MM-DD o vacío",
        },
        hora_reserva: { type: "string" },
        pack_tiempo: { type: "string" },
        precio: { type: "string" },
      },
      required: [
        "nombre",
        "whatsapp",
        "correo",
        "documento",
        "tipo",
        "fecha_reserva",
        "hora_reserva",
        "pack_tiempo",
        "precio",
      ],
      additionalProperties: false,
    },
  ],
};

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
          "Legacy: el servidor ignora estos tipos. Los CTA viven en el pie del widget; bajo el mensaje solo aparece Ver video.",
        items: {
          type: "string",
          enum: [...CHAT_ACTION_TYPES],
        },
      },
      pendingReservation: PENDING_RESERVATION_SCHEMA,
      showReservationForm: {
        type: "boolean",
        description:
          "true = el widget muestra el formulario inline de prerreserva",
      },
      showDateTimePicker: {
        type: "boolean",
        description:
          "true = el widget muestra un selector de fecha y hora para que el usuario confirme la agenda",
      },
      formPrefill: FORM_PREFILL_SCHEMA,
      suiteShowcase: {
        type: "string",
        description:
          "Id o nombre de suite a mostrar en video (p.ej. suite_vip_jacuzzi o Suite VIP Jacuzzi). Vacío si no aplica.",
      },
    },
    required: [
      "message",
      "actionTypes",
      "pendingReservation",
      "showReservationForm",
      "showDateTimePicker",
      "formPrefill",
      "suiteShowcase",
    ],
    additionalProperties: false,
  },
};

/**
 * @param {unknown} raw
 * @returns {Record<string, string> | null}
 */
function normalizeFormPrefill(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const p = /** @type {Record<string, unknown>} */ (raw);
  const keys = [
    "nombre",
    "whatsapp",
    "correo",
    "documento",
    "tipo",
    "fecha_reserva",
    "hora_reserva",
    "pack_tiempo",
    "precio",
  ];
  /** @type {Record<string, string>} */
  const out = {};
  for (const k of keys) {
    const v = typeof p[k] === "string" ? p[k].trim() : "";
    out[k] = v.slice(0, k === "nombre" || k === "correo" ? 200 : 80);
  }
  return out;
}

/**
 * @param {ChatActionType[]} types
 * @returns {ChatActionType[]}
 */
function filterBodyActionTypes(types) {
  return types.filter((type) => !BODY_EXCLUDED_ACTION_TYPES.has(type));
}

/**
 * Resuelve botones del cuerpo del chat.
 * Siempre []: CTAs viven en el pie; bajo el mensaje solo va Ver video.
 * @param {unknown} actionTypes
 * @returns {ChatOption[]}
 */
function resolveChatActions(actionTypes) {
  void actionTypes;
  return [];
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
 * @returns {{
 *   message: string;
 *   actionTypes: unknown;
 *   pendingReservation: unknown;
 *   showReservationForm: boolean;
 *   showDateTimePicker: boolean;
 *   formPrefill: unknown;
 *   suiteShowcase: string;
 * } | null}
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
      pendingReservation:
        parsed.pendingReservation === undefined
          ? null
          : parsed.pendingReservation,
      showReservationForm: Boolean(parsed.showReservationForm),
      showDateTimePicker: Boolean(parsed.showDateTimePicker),
      formPrefill:
        parsed.formPrefill === undefined ? null : parsed.formPrefill,
      suiteShowcase:
        typeof parsed.suiteShowcase === "string" ? parsed.suiteShowcase : "",
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
 * @returns {{
 *   reply: string;
 *   options: ChatOption[];
 *   actionTypes: ChatActionType[];
 *   pendingReservation: unknown;
 *   showReservationForm: boolean;
 *   showDateTimePicker: boolean;
 *   formPrefill: Record<string, string> | null;
 *   suiteShowcase: string;
 * }}
 */
function buildAssistantResponse(modelContent) {
  const structured = tryParseStructuredMartinaReply(modelContent);
  if (structured) {
    const options = resolveChatActions(structured.actionTypes);
    const rawTypes =
      Array.isArray(structured.actionTypes) && structured.actionTypes.length
        ? /** @type {ChatActionType[]} */ (
            structured.actionTypes.filter((t) => ACTION_TYPE_SET.has(t))
          )
        : [...DEFAULT_ACTION_TYPES];
    const actionTypes = filterBodyActionTypes(rawTypes);
    const showReservationForm = Boolean(structured.showReservationForm);
    const showDateTimePicker =
      Boolean(structured.showDateTimePicker) && !showReservationForm;
    const formPrefill = showReservationForm
      ? normalizeFormPrefill(structured.formPrefill)
      : null;
    return {
      reply: stripOptionsBlock(structured.message),
      options,
      actionTypes: actionTypes.length
        ? actionTypes
        : filterBodyActionTypes([...DEFAULT_ACTION_TYPES]),
      // Si se muestra el form, no crear prerreserva automática desde el JSON
      pendingReservation: showReservationForm
        ? null
        : structured.pendingReservation ?? null,
      showReservationForm,
      showDateTimePicker,
      formPrefill: formPrefill || (showReservationForm ? normalizeFormPrefill({}) : null),
      suiteShowcase:
        typeof structured.suiteShowcase === "string"
          ? structured.suiteShowcase.trim()
          : "",
    };
  }

  const legacy = parseLegacyOptionsReply(modelContent);
  // Ignoramos URLs del legado: el servidor siempre usa el catálogo.
  const options = resolveChatActions(DEFAULT_ACTION_TYPES);
  return {
    reply: legacy.reply,
    options,
    actionTypes: filterBodyActionTypes([...DEFAULT_ACTION_TYPES]),
    pendingReservation: null,
    showReservationForm: false,
    showDateTimePicker: false,
    formPrefill: null,
    suiteShowcase: "",
  };
}

module.exports = {
  CHAT_ACTION_TYPES,
  CHAT_ACTIONS,
  DEFAULT_ACTION_TYPES,
  BODY_EXCLUDED_ACTION_TYPES,
  MARTINA_REPLY_JSON_SCHEMA,
  resolveChatActions,
  filterBodyActionTypes,
  stripOptionsBlock,
  tryParseStructuredMartinaReply,
  parseLegacyOptionsReply,
  buildAssistantResponse,
  normalizeFormPrefill,
};
