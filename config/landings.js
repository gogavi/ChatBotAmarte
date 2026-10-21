/**
 * Catálogo único de las landings de Amarte.
 * `id` es el valor de `funnel_events.proyecto`.
 * Las URL se comprobaron con HTTP 200 el 21-oct-2026.
 * deluxe.amartesuite.com sirve el mismo HTML que suite-sauna-jacuzzi.
 */

/**
 * @typedef {"product"|"form"} LandingKind
 * @typedef {"promo-jacuzzi"|null} LandingOffer
 * @typedef {{
 *   label: string;
 *   roomTypeName: string;
 *   catalogId: string | null;
 *   phrases: readonly string[];
 * }} LandingSuite
 * @typedef {{
 *   id: string;
 *   nombre: string;
 *   url: string;
 *   aliasUrls: readonly string[];
 *   kind: LandingKind;
 *   offer: LandingOffer;
 *   distinctPhrases: readonly string[];
 *   suites: readonly LandingSuite[];
 * }} Landing
 */

/** @type {readonly Landing[]} */
const LANDINGS = Object.freeze([
  Object.freeze({
    id: "suite-jacuzzi",
    nombre: "Suite Jacuzzi",
    url: "https://microservicio-suite-jacuzzi.vercel.app",
    aliasUrls: Object.freeze([]),
    kind: "product",
    offer: null,
    distinctPhrases: Object.freeze([]),
    suites: Object.freeze([
      Object.freeze({
        label: "Suite Jacuzzi",
        roomTypeName: "Suite Jacuzzi",
        catalogId: "suite_vip_jacuzzi",
        phrases: Object.freeze(["suite jacuzzi", "suite vip jacuzzi", "vip jacuzzi"]),
      }),
    ]),
  }),
  Object.freeze({
    id: "promo-suite-jacuzzi",
    nombre: "Promo Suite Jacuzzi",
    url: "https://microservicio-promo-suite-jacuzzi.vercel.app",
    aliasUrls: Object.freeze([]),
    kind: "product",
    offer: "promo-jacuzzi",
    distinctPhrases: Object.freeze(["promo jacuzzi", "promo suite jacuzzi"]),
    suites: Object.freeze([
      Object.freeze({
        label: "Suite Jacuzzi",
        roomTypeName: "Suite Jacuzzi",
        catalogId: "suite_vip_jacuzzi",
        phrases: Object.freeze([]),
      }),
    ]),
  }),
  Object.freeze({
    id: "promo-suite-amarte",
    nombre: "Promo Suite Amarte",
    url: "https://microservicio-promo-suite-amarte.vercel.app",
    aliasUrls: Object.freeze([]),
    kind: "product",
    offer: null,
    distinctPhrases: Object.freeze([]),
    suites: Object.freeze([
      Object.freeze({
        label: "Suite Amarte",
        roomTypeName: "Suite Amarte",
        catalogId: "suite_amarte",
        phrases: Object.freeze(["suite amarte"]),
      }),
    ]),
  }),
  Object.freeze({
    id: "tematicas",
    nombre: "Suites temáticas",
    url: "https://microservicio-suite-tematicas.vercel.app",
    aliasUrls: Object.freeze([]),
    kind: "product",
    offer: null,
    distinctPhrases: Object.freeze([]),
    suites: Object.freeze([
      Object.freeze({
        label: "Suite Árabe",
        roomTypeName: "Suite Árabe",
        catalogId: "suite_arabe",
        phrases: Object.freeze(["suite arabe", "suite árabe"]),
      }),
      Object.freeze({
        label: "Suite Queen",
        roomTypeName: "Suite Queen",
        catalogId: "suite_queen",
        phrases: Object.freeze(["suite queen"]),
      }),
      Object.freeze({
        label: "Suite Gótica",
        roomTypeName: "Suite Gótica",
        catalogId: "suite_gotica",
        phrases: Object.freeze(["suite gotica", "suite gótica"]),
      }),
      Object.freeze({
        label: "Suite Diamante",
        roomTypeName: "Suite Diamante",
        catalogId: "suite_diamante",
        phrases: Object.freeze(["suite diamante"]),
      }),
    ]),
  }),
  Object.freeze({
    id: "suite-sauna-jacuzzi",
    nombre: "Gold, Rubí y Zafiro",
    url: "https://microservicio-suite-sauna-jacuzzi.vercel.app",
    aliasUrls: Object.freeze(["https://deluxe.amartesuite.com"]),
    kind: "product",
    offer: null,
    distinctPhrases: Object.freeze([]),
    suites: Object.freeze([
      Object.freeze({
        label: "Suite Gold",
        roomTypeName: "Suite Gold",
        catalogId: "suite_gold",
        phrases: Object.freeze(["suite gold"]),
      }),
      Object.freeze({
        label: "Suite Rubí",
        roomTypeName: "Suite Rubí",
        catalogId: "suite_rubi",
        phrases: Object.freeze(["suite rubi", "suite rubí"]),
      }),
      Object.freeze({
        label: "Suite Zafiro",
        roomTypeName: "Suite Zafiro",
        catalogId: "suite_zafiro",
        phrases: Object.freeze(["suite zafiro"]),
      }),
    ]),
  }),
  Object.freeze({
    id: "suite-gamer",
    nombre: "Suite Gamer",
    url: "https://microservicio-suite-gamer.vercel.app",
    aliasUrls: Object.freeze([]),
    kind: "product",
    offer: null,
    distinctPhrases: Object.freeze([]),
    suites: Object.freeze([
      Object.freeze({
        label: "Suite Gamer",
        roomTypeName: "Suite Gamer",
        catalogId: null,
        phrases: Object.freeze(["suite gamer"]),
      }),
    ]),
  }),
  Object.freeze({
    id: "reservas",
    nombre: "Pre-reserva",
    url: "https://microservicio-reservas.vercel.app",
    aliasUrls: Object.freeze([]),
    kind: "form",
    offer: null,
    distinctPhrases: Object.freeze([]),
    suites: Object.freeze([]),
  }),
]);

/**
 * @param {unknown} raw
 * @returns {Landing | null}
 */
function resolveLanding(raw) {
  if (typeof raw !== "string") return null;
  const id = raw.trim().toLowerCase();
  if (!id) return null;
  return LANDINGS.find((landing) => landing.id === id) || null;
}

/**
 * Orígenes de navegador derivados del catálogo, en el mismo orden.
 * deluxe queda junto a suite-sauna-jacuzzi.
 * @returns {string[]}
 */
function landingBrowserOrigins() {
  /** @type {string[]} */
  const origins = [];
  for (const landing of LANDINGS) {
    const urls = [landing.url, ...landing.aliasUrls];
    for (const url of urls) {
      const origin = new URL(url).origin;
      if (!origins.includes(origin)) origins.push(origin);
    }
  }
  return origins;
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeLandingText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} norm
 * @param {string} phrase
 * @returns {boolean}
 */
function hasPhrase(norm, phrase) {
  const folded = normalizeLandingText(phrase);
  if (!folded) return false;
  const escaped = folded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(norm);
}

/**
 * Landings de producto distintas de la activa cuyo nombre aparece en el mensaje.
 * @param {string} userMessage
 * @param {Landing} active
 * @returns {Landing[]}
 */
/**
 * @param {Landing} landing
 * @returns {{ phrase: string; roomTypeName: string | null }[]}
 */
function landingMatchPhrases(landing) {
  return [
    ...landing.distinctPhrases.map((phrase) => ({
      phrase,
      roomTypeName: null,
    })),
    ...landing.suites.flatMap((suite) =>
      suite.phrases.map((phrase) => ({
        phrase,
        roomTypeName: suite.roomTypeName,
      }))
    ),
  ];
}

function landingsAskedInMessage(userMessage, active) {
  const norm = normalizeLandingText(userMessage);
  if (!norm) return [];
  const activeRooms = new Set(active.suites.map((suite) => suite.roomTypeName));
  /** @type {{ landing: Landing; phrase: string; roomTypeName: string | null }[]} */
  const matches = [];
  for (const landing of LANDINGS) {
    if (landing.id === active.id || landing.kind === "form") continue;
    for (const item of landingMatchPhrases(landing)) {
      const phrase = normalizeLandingText(item.phrase);
      if (!phrase || !hasPhrase(norm, phrase)) continue;
      matches.push({ landing, phrase, roomTypeName: item.roomTypeName });
    }
  }
  const surviving = matches.filter((hit) => {
    const insideLongerPhrase = matches.some(
      (other) => other.phrase.length > hit.phrase.length && hasPhrase(other.phrase, hit.phrase)
    );
    if (insideLongerPhrase) return false;
    if (hit.roomTypeName && activeRooms.has(hit.roomTypeName)) return false;
    return true;
  });
  /** @type {Landing[]} */
  const hits = [];
  const seen = new Set();
  for (const hit of surviving) {
    if (seen.has(hit.landing.id)) continue;
    seen.add(hit.landing.id);
    hits.push(hit.landing);
  }
  return hits;
}

module.exports = {
  LANDINGS,
  resolveLanding,
  landingBrowserOrigins,
  normalizeLandingText,
  landingsAskedInMessage,
};
