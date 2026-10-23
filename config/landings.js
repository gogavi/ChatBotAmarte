const { PLAN_SUITE_RULES, PLAN_CHOICE_GROUP } = require("./planSuites");

/**
 * Catálogo único de las landings de Amarte.
 * `id` es el id del catálogo. En temáticas el embudo manda `suite-tematicas`;
 * ese valor es un alias de id y resuelve la misma landing.
 * Las URL de vercel.app se comprobaron con HTTP 200 el 21-oct-2026.
 * Cada landing de producción vive en aliasUrls (mismo HTML que su url).
 * deluxe.amartesuite.com sirve el mismo HTML que suite-sauna-jacuzzi.
 * tematica.amartesuite.com es el host real; tematicas.amartesuite.com no resuelve.
 */

/**
 * @typedef {"product"|"form"} LandingKind
 * @typedef {"promo-jacuzzi"|"promo-amarte"|null} LandingOffer
 * @typedef {"tematicas"|"deluxe"|null} LandingGrupo
 * @typedef {{
 *   hourPrice: number;
 *   threeHourDiscount: number | null;
 * }} PromoAmarteTerms
 * @typedef {{
 *   label: string;
 *   roomTypeName: string;
 *   catalogId: string | null;
 *   phrases: readonly string[];
 * }} LandingSuite
 * @typedef {{
 *   id: string;
 *   idAliases?: readonly string[];
 *   nombre: string;
 *   url: string;
 *   aliasUrls: readonly string[];
 *   kind: LandingKind;
 *   grupo?: LandingGrupo;
 *   offer: LandingOffer;
 *   promoAmarte?: PromoAmarteTerms;
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
    aliasUrls: Object.freeze(["https://suitejacuzzi.amartesuite.com"]),
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
    aliasUrls: Object.freeze(["https://promojacuzzi.amartesuite.com"]),
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
    aliasUrls: Object.freeze(["https://promoamarte.amartesuite.com"]),
    kind: "product",
    // Beneficio confirmado por Guillermo: la hora a 30000.
    // El descuento de 3 horas (pago parcial o total) sigue sin monto.
    offer: "promo-amarte",
    promoAmarte: Object.freeze({
      hourPrice: 30000,
      threeHourDiscount: null,
    }),
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
    // proyecto del embudo de la página. El id canónico sigue siendo tematicas.
    idAliases: Object.freeze(["suite-tematicas"]),
    nombre: "Suites temáticas",
    url: "https://microservicio-suite-tematicas.vercel.app",
    aliasUrls: Object.freeze(["https://tematica.amartesuite.com"]),
    kind: "product",
    grupo: "tematicas",
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
    grupo: "deluxe",
    offer: null,
    distinctPhrases: Object.freeze(["sauna", "suite sauna", "sauna jacuzzi"]),
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
    aliasUrls: Object.freeze(["https://suitegamer.amartesuite.com"]),
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
    aliasUrls: Object.freeze(["https://reservas.amartesuite.com"]),
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
  return (
    LANDINGS.find((landing) => {
      if (landing.id === id) return true;
      const aliases = landing.idAliases || [];
      return aliases.some((alias) => alias === id);
    }) || null
  );
}

/**
 * Landing cuyo origen (url o alias) coincide con el de la página.
 * www.amartesuite.com y amartesuite.com no son una landing.
 * @param {unknown} pageUrl
 * @returns {Landing | null}
 */
function resolveLandingByPageUrl(pageUrl) {
  if (typeof pageUrl !== "string" || !pageUrl.trim()) return null;
  let origin;
  try {
    const url = new URL(pageUrl.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    origin = url.origin;
  } catch {
    return null;
  }
  for (const landing of LANDINGS) {
    for (const item of [landing.url, ...landing.aliasUrls]) {
      if (new URL(item).origin === origin) return landing;
    }
  }
  return null;
}

/**
 * El id explícito gana. Si no es un id del catálogo, la página elige por origen.
 * @param {unknown} rawLanding
 * @param {unknown} pageUrl
 * @returns {Landing | null}
 */
function resolveChatLanding(rawLanding, pageUrl) {
  const explicit = resolveLanding(rawLanding);
  if (explicit) return explicit;
  return resolveLandingByPageUrl(pageUrl);
}

/**
 * Alias exacto de una landing. "sauna" y "suite sauna" son Sauna Jacuzzi.
 * No resuelve una frase larga: el texto libre lo cubre landingsAskedInMessage.
 * @param {unknown} raw
 * @returns {Landing | null}
 */
function resolveLandingByAlias(raw) {
  if (typeof raw !== "string") return null;
  const key = normalizeLandingText(raw);
  if (!key) return null;
  for (const landing of LANDINGS) {
    for (const phrase of landing.distinctPhrases) {
      if (normalizeLandingText(phrase) === key) return landing;
    }
  }
  return null;
}

/**
 * Orígenes de navegador derivados del catálogo, en el mismo orden.
 * Cada alias de producción queda junto a su url de vercel.app.
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

/**
 * Landings de producto que incluyen alguno de estos room types.
 * promo-jacuzzi no entra: esa suite ya tiene su página sin promo.
 * promo-amarte sí entra: es la única página de Suite Amarte.
 * @param {readonly string[]} roomTypeNames
 * @returns {Landing[]}
 */
function landingsForRoomTypes(roomTypeNames) {
  const wanted = new Set(roomTypeNames);
  return LANDINGS.filter(
    (landing) =>
      landing.kind === "product" &&
      landing.offer !== "promo-jacuzzi" &&
      landing.suites.some((suite) => wanted.has(suite.roomTypeName))
  );
}

/**
 * @param {string} norm
 * @returns {Set<string>}
 */
function suppressedLandingPhrases(norm) {
  /** @type {Set<string>} */
  const suppressed = new Set();
  for (const rule of PLAN_SUITE_RULES) {
    if (!hasPhrase(norm, rule.plan)) continue;
    for (const phrase of rule.suppressPhrases) {
      suppressed.add(normalizeLandingText(phrase));
    }
  }
  return suppressed;
}

/**
 * Suites del grupo de elección que el mensaje nombra junto con uno de sus planes.
 * @param {string} norm
 * @returns {string[]}
 */
function choiceSuitesNamed(norm) {
  const planNamed = PLAN_CHOICE_GROUP.plans.some((plan) => hasPhrase(norm, plan));
  if (!planNamed) return [];
  return PLAN_CHOICE_GROUP.suites.filter((name) => hasPhrase(norm, name));
}

/**
 * Landings distintas de la activa que el mensaje pide, más la landing de las
 * suites del plan cuando el mensaje nombra un plan de PLAN_SUITE_RULES.
 * @param {string} userMessage
 * @param {Landing} active
 * @returns {Landing[]}
 */
function landingsAskedInMessage(userMessage, active) {
  const norm = normalizeLandingText(userMessage);
  if (!norm) return [];
  const activeRooms = new Set(active.suites.map((suite) => suite.roomTypeName));
  const suppressed = suppressedLandingPhrases(norm);
  /** @type {{ landing: Landing; phrase: string; roomTypeName: string | null }[]} */
  const matches = [];
  for (const landing of LANDINGS) {
    if (landing.id === active.id || landing.kind === "form") continue;
    for (const item of landingMatchPhrases(landing)) {
      const phrase = normalizeLandingText(item.phrase);
      if (!phrase || suppressed.has(phrase) || !hasPhrase(norm, phrase)) continue;
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
  const chosen = choiceSuitesNamed(norm);
  for (const rule of PLAN_SUITE_RULES) {
    if (!hasPhrase(norm, rule.plan)) continue;
    const limitToChoice =
      chosen.length > 0 && PLAN_CHOICE_GROUP.plans.includes(rule.plan);
    for (const landing of landingsForRoomTypes(rule.suites)) {
      if (landing.id === active.id || seen.has(landing.id)) continue;
      if (
        limitToChoice &&
        !landing.suites.some((suite) => chosen.includes(suite.roomTypeName))
      ) {
        continue;
      }
      seen.add(landing.id);
      hits.push(landing);
    }
  }
  return hits;
}

module.exports = {
  LANDINGS,
  resolveLanding,
  resolveLandingByPageUrl,
  resolveChatLanding,
  resolveLandingByAlias,
  landingBrowserOrigins,
  normalizeLandingText,
  landingsAskedInMessage,
  landingsForRoomTypes,
};
