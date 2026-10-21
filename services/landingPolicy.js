/**
 * Política de una landing ya resuelta: texto del prompt, tarifas de room_rates,
 * enlace oficial si piden otra suite, y cierre del formulario de prerreserva.
 * Sin `landing`, las tres funciones de servidor no cambian el turno.
 */

const { formatCop } = require("../config/amarteCatalog");
const {
  LANDINGS,
  resolveLanding,
  landingsAskedInMessage,
} = require("../config/landings");
const { VALID_TIPOS } = require("../reservationService");
const { getRoomRatesCatalog } = require("./roomRatesCatalog");
const { stripPaymentPromoBlocks } = require("./suiteChatEnrichment");

const DURATION_ROWS = Object.freeze([
  ["h4", "4 h"],
  ["h6", "6 h"],
  ["h8", "8 h"],
  ["h12", "12 h"],
  ["diaHotelero", "Día hotelero"],
]);

/**
 * @param {LandingOffer | null} offer
 * @returns {void}
 */
function assertKnownOffer(offer) {
  if (offer === null || offer === "promo-jacuzzi") return;
  const unknown = offer;
  throw new Error(`oferta de landing no reconocida: ${unknown}`);
}

/**
 * @param {"product"|"form"} kind
 * @returns {void}
 */
function assertKnownKind(kind) {
  if (kind === "product" || kind === "form") return;
  const unknown = kind;
  throw new Error(`tipo de landing no reconocido: ${unknown}`);
}

/**
 * Montos que el prompt ya fija aunque room_rates no responda.
 * @returns {Set<number>}
 */
function canonicalAmounts() {
  return new Set();
}

const MONEY_RE =
  /(?:\bCOP\s?\$?\s?|\$\s?)?\d{1,3}(?:[.\u00a0]\d{3})+(?:,\d+)?(?:\s*(?:COP|pesos))?|(?:\bCOP\s?\$?\s?|\$\s?)?\d{1,3}(?:,\d{3})+(?:\s*(?:COP|pesos))?|(?:\$\s?|\bCOP\s?\$?\s?)\d{5,7}\b(?:\s*(?:COP|pesos))?|\b\d{5,7}\b(?:\s*(?:pesos|COP))?|\b\d{2,3}\s*mil\b/gi;

/**
 * @param {string} text
 * @param {Set<number>} [allow]
 * @returns {string}
 */
function stripUntrustedCopAmounts(text, allow) {
  const allowed = allow instanceof Set ? allow : canonicalAmounts();
  return String(text || "").replace(MONEY_RE, (token) => {
    const digits = token.replace(/mil/i, "000").replace(/\D/g, "");
    const amount = Number(digits);
    if (allowed.has(amount)) return token;
    return "tarifa no disponible";
  });
}

/**
 * @param {import("../config/landings").Landing} landing
 * @returns {string}
 */
function unavailablePriceSentence(landing) {
  assertKnownOffer(landing.offer);
  return (
    "Las tarifas de lista no están disponibles en este momento. " +
    "No inventes montos de suites ni de packs. " +
    "Invita al formulario de esta página o al botón de WhatsApp del pie del chat."
  );
}

/**
 * @param {{ weekday?: Record<string, number>; weekend?: Record<string, number>; name: string }} entry
 * @returns {string}
 */
function formatRateEntry(entry) {
  const lines = [`**${entry.name}**`];
  const bands = [
    ["weekday", "Domingo–jueves"],
    ["weekend", "Viernes–sábado"],
  ];
  for (const [key, title] of bands) {
    const table = entry[key] || {};
    const rows = DURATION_ROWS.filter(([duration]) => {
      const price = table[duration];
      return Number.isFinite(price) && price > 0;
    });
    if (!rows.length) continue;
    lines.push(`${title}:`);
    for (const [duration, label] of rows) {
      lines.push(`- ${label}: ${formatCop(table[duration])}`);
    }
  }
  return lines.join("\n");
}

/**
 * @param {import("../config/landings").Landing} landing
 * @param {ReadonlyMap<string, any> | null} rates
 * @returns {string}
 */
function formatLandingPriceBlock(landing, rates) {
  assertKnownKind(landing.kind);
  if (!(rates instanceof Map)) return unavailablePriceSentence(landing);

  if (landing.kind === "form") {
    const lines = [
      "Catálogo room_rates cargado. Cotiza solo el tipo que el cliente nombre. No abras con la matriz completa y no uses tarifas escritas a mano.",
    ];
    for (const name of VALID_TIPOS) {
      const entry = rates.get(name);
      if (!entry) continue;
      lines.push(formatRateEntry(entry));
    }
    return lines.join("\n");
  }

  const lines = ["Tarifas de lista de esta landing (room_rates):"];
  for (const suite of landing.suites) {
    const entry = rates.get(suite.roomTypeName);
    if (!entry) {
      lines.push(
        `${suite.label}: sin fila en room_rates. No inventes el monto; invita al formulario de esta landing.`
      );
      continue;
    }
    lines.push(formatRateEntry(entry));
  }
  return lines.join("\n");
}

/**
 * @param {import("../config/landings").Landing} landing
 * @param {ReadonlyMap<string, any> | null} rates
 * @returns {string}
 */
function buildLandingAddendum(landing, rates) {
  assertKnownKind(landing.kind);
  const focus =
    landing.kind === "form"
      ? "Esta página es el formulario general de pre-reserva, no una sola suite."
      : `Enfócate en ${landing.suites.map((suite) => suite.label).join(", ")}.`;
  const others = LANDINGS.filter((item) => item.id !== landing.id)
    .map((item) => `- ${item.nombre} (${item.id})`)
    .join("\n");
  return [
    "## Landing activa",
    `id: ${landing.id}`,
    `nombre: ${landing.nombre}`,
    focus,
    "No abras el formulario del chat: showReservationForm false, showDateTimePicker false, pendingReservation null. Invita al formulario de esta página o a WhatsApp del pie.",
    "Si preguntan por otra suite, nómbrala. El servidor añade el enlace oficial. No inventes URLs ni enlaces a amartesuite.com/producto.",
    "Otras landings:",
    others,
    formatLandingPriceBlock(landing, rates),
  ].join("\n");
}

/**
 * @param {unknown} raw
 * @returns {Promise<{ landing: import("../config/landings").Landing; pricesAvailable: boolean; addendum: string } | null>}
 */
async function beginLandingTurn(raw) {
  const landing = resolveLanding(raw);
  if (!landing) return null;
  let rates = null;
  try {
    rates = await getRoomRatesCatalog();
  } catch (err) {
    console.warn(
      "[landingPolicy] room_rates:",
      err && err.message ? err.message : err
    );
    rates = null;
  }
  const allowedAmounts = collectLandingAmounts(landing, rates instanceof Map ? rates : null);
  const pricesAvailable = allowedAmounts.size > 0;
  return Object.freeze({
    landing,
    pricesAvailable,
    allowedAmounts,
    addendum: buildLandingAddendum(landing, pricesAvailable ? rates : null),
  });
}

/**
 * Montos de room_rates que esta landing puede repetir.
 * @param {import("../config/landings").Landing} landing
 * @param {ReadonlyMap<string, any> | null} rates
 * @returns {Set<number>}
 */
function collectLandingAmounts(landing, rates) {
  const allow = new Set();
  if (!(rates instanceof Map)) return allow;
  assertKnownKind(landing.kind);
  const names =
    landing.kind === "form"
      ? VALID_TIPOS
      : landing.suites.map((suite) => suite.roomTypeName);
  for (const name of names) {
    const entry = rates.get(name);
    if (!entry) continue;
    for (const band of ["weekday", "weekend"]) {
      const table = entry[band] || {};
      for (const [duration] of DURATION_ROWS) {
        const price = table[duration];
        if (Number.isFinite(price) && price > 0) allow.add(price);
      }
    }
  }
  return allow;
}

/**
 * @param {{ landing: import("../config/landings").Landing } | null} turn
 * @param {{
 *   showReservationForm: boolean;
 *   showDateTimePicker: boolean;
 *   pendingReservation: unknown;
 *   formPrefill: Record<string, string> | null;
 * }} flags
 */
function clampLandingReservation(turn, flags) {
  if (!turn || !turn.landing) return flags;
  return {
    showReservationForm: false,
    showDateTimePicker: false,
    pendingReservation: null,
    formPrefill: null,
  };
}

/**
 * @param {string} url
 * @param {Set<string>} allowedOrigins
 * @returns {boolean}
 */
/**
 * @param {string} raw
 * @returns {{ host: string; key: string; search: string; hash: string; username: string; pathname: string }}
 */
function parsePolicyUrl(raw) {
  const trimmed = String(raw).replace(/[.,;:!?]+$/g, "");
  const parsed = new URL(trimmed);
  const host = parsed.hostname.replace(/\.+$/g, "").toLowerCase();
  const path = parsed.pathname.replace(/\/+$/g, "");
  return {
    host,
    key: `${parsed.protocol}//${host}${path}`,
    search: parsed.search,
    hash: parsed.hash,
    username: parsed.username,
    pathname: parsed.pathname,
  };
}

/**
 * @returns {Set<string>}
 */
function catalogUrlKeys() {
  const keys = new Set();
  for (const landing of LANDINGS) {
    for (const url of [landing.url, ...landing.aliasUrls]) {
      keys.add(parsePolicyUrl(url).key);
    }
  }
  return keys;
}

/**
 * @param {string} url
 * @param {Set<string>} allowedKeys
 * @returns {boolean}
 */
function isForeignUrl(url, allowedKeys) {
  let parsed;
  try {
    parsed = parsePolicyUrl(url);
  } catch {
    return false;
  }
  const exact =
    allowedKeys.has(parsed.key) && !parsed.search && !parsed.hash && !parsed.username;
  if (exact) return false;
  const host = parsed.host;
  if (
    host === "vercel.app" ||
    host.endsWith(".vercel.app") ||
    host.includes(".vercel.app.")
  ) {
    return true;
  }
  if (
    (host === "amartesuite.com" || host === "www.amartesuite.com") &&
    /\/producto\//i.test(parsed.pathname)
  ) {
    return true;
  }
  if (host === "deluxe.amartesuite.com") return true;
  return false;
}

/**
 * @param {string} text
 * @returns {string}
 */
function stripForeignUrls(text) {
  const allowed = catalogUrlKeys();
  let out = String(text || "").replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (full, label, url) => (isForeignUrl(url, allowed) ? label : full)
  );
  out = out.replace(/https?:\/\/[^\s)]+/gi, (url) =>
    isForeignUrl(url, allowed) ? "" : url
  );
  return out.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n");
}

/**
 * @param {string} reply
 * @param {import("../config/landings").Landing} active
 * @param {string} userMessage
 * @returns {string}
 */
function appendLandingRedirects(reply, active, userMessage) {
  let text = String(reply || "");
  const asked = landingsAskedInMessage(userMessage, active);
  for (const landing of asked) {
    if (text.includes(landing.url)) continue;
    text += `\n\n[${landing.nombre}](${landing.url})`;
  }
  return text;
}

/**
 * @param {{ landing: import("../config/landings").Landing; pricesAvailable: boolean } | null} turn
 * @param {string} reply
 * @param {string} [userMessage]
 * @returns {string}
 */
/**
 * @param {string} text
 * @param {import("../config/landings").Landing} landing
 * @returns {string}
 */
function appendUnavailablePriceLine(text, landing) {
  if (landing) assertKnownOffer(landing.offer);
  const line =
    "Las tarifas de lista no están disponibles. Usa el formulario o WhatsApp.";
  return `${String(text || "").trim()}\n\n${line}`.trim();
}

/**
 * Montos positivos de todo el catálogo room_rates.
 * @param {ReadonlyMap<string, any> | null} rates
 * @returns {Set<number>}
 */
function collectAllAmounts(rates) {
  const allow = new Set();
  if (!(rates instanceof Map)) return allow;
  for (const entry of rates.values()) {
    for (const band of ["weekday", "weekend"]) {
      const table = entry && entry[band] ? entry[band] : {};
      for (const price of Object.values(table)) {
        if (Number.isFinite(price) && price > 0) allow.add(price);
      }
    }
  }
  return allow;
}

/**
 * Bloque de tarifas para amartesuite.com, sin landing.
 * @param {ReadonlyMap<string, any> | null} rates
 * @returns {string}
 */
function buildSitePriceAddendum(rates) {
  const allow = collectAllAmounts(rates);
  if (!allow.size) {
    return [
      "## Tarifas de lista",
      "Las tarifas de lista no están disponibles en este momento.",
      "No inventes montos.",
      "Invita al formulario o al botón de WhatsApp del pie del chat.",
    ].join("\n");
  }
  const lines = [
    "## Tarifas de lista (room_rates)",
    "Cotiza solo estos montos. Si una suite no aparece, no inventes el precio. Formulario o WhatsApp.",
  ];
  for (const entry of rates.values()) {
    lines.push(formatRateEntry(entry));
  }
  return lines.join("\n");
}

/**
 * Landing resuelta, o el catálogo general de amartesuite.com.
 * @param {unknown} raw
 */
async function beginPriceTurn(raw) {
  const landingTurn = await beginLandingTurn(raw);
  if (landingTurn) return landingTurn;
  let rates = null;
  try {
    rates = await getRoomRatesCatalog();
  } catch (err) {
    console.warn(
      "[landingPolicy] room_rates:",
      err && err.message ? err.message : err
    );
    rates = null;
  }
  const map = rates instanceof Map ? rates : null;
  const allowedAmounts = collectAllAmounts(map);
  return Object.freeze({
    landing: null,
    pricesAvailable: allowedAmounts.size > 0,
    allowedAmounts,
    addendum: buildSitePriceAddendum(map),
  });
}

/**
 * @param {{ landing: import("../config/landings").Landing; pricesAvailable: boolean; allowedAmounts?: Set<number> } | null} turn
 * @returns {Set<number> | null}
 */
function replyAmountAllowlist(turn) {
  if (!turn.pricesAvailable) return new Set();
  if (turn.allowedAmounts instanceof Set) return turn.allowedAmounts;
  return null;
}

function finishLandingReply(turn, reply, userMessage) {
  if (!turn) return reply;
  let text = String(reply || "");
  const allow = replyAmountAllowlist(turn);
  if (allow) {
    text = stripPaymentPromoBlocks(stripUntrustedCopAmounts(text, allow));
    if (!turn.pricesAvailable) text = appendUnavailablePriceLine(text, turn.landing);
  }
  if (!turn.landing) return text;
  text = stripForeignUrls(text);
  return appendLandingRedirects(text, turn.landing, userMessage || "");
}

module.exports = {
  beginLandingTurn,
  beginPriceTurn,
  clampLandingReservation,
  finishLandingReply,
  formatLandingPriceBlock,
  stripUntrustedCopAmounts,
};
