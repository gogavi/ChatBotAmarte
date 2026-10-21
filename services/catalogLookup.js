/**
 * Lookup de tarifas: solo Supabase `room_rates`.
 * Si no hay fila con precio mayor que 0, no hay monto.
 */

const { pricing, formatCop, suiteCategories, contact } = require("../config/amarteCatalog");
const { resolveTipo } = require("../reservationService");
const { dateTypeFromIsoDate } = require("./bogotaTime");
const { formatMoneyAmount } = require("../ttsNormalize");
const {
  getRoomRatesCatalog,
  getRoomExtrasCatalog,
  findDbCatalogEntry,
  extrasApplicableToNames,
  isDecorationExtra,
} = require("./roomRatesCatalog");
const { resolveLandingByAlias, landingsForRoomTypes } = require("../config/landings");
const { ruleForPlan } = require("../config/planSuites");

/** @typedef {"h4"|"h8"|"h12"|"diaHotelero"|"h6"} DurationKey */

const DURATION_ALIASES = {
  "4": "h4",
  "4h": "h4",
  "4 h": "h4",
  "4 horas": "h4",
  "pack 4 horas": "h4",
  "8": "h8",
  "8h": "h8",
  "8 h": "h8",
  "8 horas": "h8",
  "pack 8 horas": "h8",
  "12": "h12",
  "12h": "h12",
  "12 h": "h12",
  "12 horas": "h12",
  "pack 12 horas": "h12",
  "6": "h6",
  "6h": "h6",
  "6 h": "h6",
  "6 horas": "h6",
  "pack 6 horas": "h6",
  dia: "diaHotelero",
  "día": "diaHotelero",
  "dia hotelero": "diaHotelero",
  "día hotelero": "diaHotelero",
};

/**
 * @param {number} priceCop
 */
function toSpokenPrice(priceCop) {
  if (!Number.isFinite(priceCop)) {
    return "";
  }
  const base = formatMoneyAmount(String(Math.round(priceCop)));
  try {
    const words = numberToSpanishWords(Math.round(priceCop));
    if (words) {
      return `${words} pesos`;
    }
  } catch {
    // fallback
  }
  return base;
}

/**
 * @param {number} n
 */
function numberToSpanishWords(n) {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "cero";

  const units = [
    "",
    "uno",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
    "dieciséis",
    "diecisiete",
    "dieciocho",
    "diecinueve",
    "veinte",
  ];
  const tens = [
    "",
    "",
    "veinti",
    "treinta",
    "cuarenta",
    "cincuenta",
    "sesenta",
    "setenta",
    "ochenta",
    "noventa",
  ];
  const hundreds = [
    "",
    "ciento",
    "doscientos",
    "trescientos",
    "cuatrocientos",
    "quinientos",
    "seiscientos",
    "setecientos",
    "ochocientos",
    "novecientos",
  ];

  function under100(x) {
    if (x <= 20) return units[x];
    if (x < 30) {
      return x === 20 ? "veinte" : `veinti${units[x - 20]}`;
    }
    const t = Math.floor(x / 10);
    const u = x % 10;
    return u === 0 ? tens[t] : `${tens[t]} y ${units[u]}`;
  }

  function under1000(x) {
    if (x < 100) return under100(x);
    if (x === 100) return "cien";
    const h = Math.floor(x / 100);
    const rest = x % 100;
    return rest === 0 ? hundreds[h] : `${hundreds[h]} ${under100(rest)}`;
  }

  if (n >= 1_000_000) {
    const mill = Math.floor(n / 1_000_000);
    const rest = n % 1_000_000;
    const millWord = mill === 1 ? "un millón" : `${under1000(mill)} millones`;
    if (rest === 0) return millWord;
    return `${millWord} ${numberToSpanishWords(rest)}`;
  }

  if (n >= 1000) {
    const thou = Math.floor(n / 1000);
    const rest = n % 1000;
    const thouWord = thou === 1 ? "mil" : `${under1000(thou)} mil`;
    if (rest === 0) return thouWord;
    return `${thouWord} ${under1000(rest)}`;
  }

  return under1000(n);
}

/**
 * @param {string} raw
 * @returns {DurationKey|null}
 */
function normalizeDuration(raw) {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return DURATION_ALIASES[key] || null;
}

/**
 * Resuelve el nombre de la suite. No devuelve montos.
 * @param {string} suiteQuery
 * @returns {{ key: string; name: string; kind: "suite"|"plan"; entry: object }|null}
 */
function findCatalogEntry(suiteQuery) {
  if (!suiteQuery || typeof suiteQuery !== "string") return null;
  const q = suiteQuery.trim().toLowerCase();
  if (!q) return null;

  for (const [key, entry] of Object.entries(pricing.suites)) {
    const name = String(entry.name || "").toLowerCase();
    if (name === q || name.includes(q) || q.includes(name)) {
      return { key, name: entry.name, kind: "suite", entry };
    }
    if (
      (q.includes("jacuzzi") && key === "suite_jacuzzi") ||
      (q.includes("amarte") && !q.includes("plan") && key === "suite_amarte") ||
      ((q.includes("cabaña") || q.includes("cabana") || q.includes("movimiento")) &&
        key === "suite_cabana_o_movimiento") ||
      ((q.includes("deluxe") ||
        q.includes("temática") ||
        q.includes("tematica") ||
        q.includes("diamante") ||
        q.includes("gold") ||
        q.includes("rubí") ||
        q.includes("rubi") ||
        q.includes("zafiro") ||
        q.includes("árabe") ||
        q.includes("arabe") ||
        q.includes("gótica") ||
        q.includes("gotica") ||
        q.includes("queen")) &&
        key === "suites_deluxe_tematicas")
    ) {
      return { key, name: entry.name, kind: "suite", entry };
    }
  }

  for (const [key, entry] of Object.entries(pricing.plans)) {
    const name = String(entry.name || "").toLowerCase();
    if (name === q || name.includes(q) || q.includes(name)) {
      return { key, name: entry.name, kind: "plan", entry };
    }
  }

  for (const cat of suiteCategories) {
    for (const s of cat.suites) {
      const label = String(s.label || "").toLowerCase();
      if (label === q || label.includes(q) || q.includes(label)) {
        if (cat.id === "jacuzzi") {
          return {
            key: "suite_jacuzzi",
            name: pricing.suites.suite_jacuzzi.name,
            kind: "suite",
            entry: pricing.suites.suite_jacuzzi,
          };
        }
        if (cat.id === "deluxe" || cat.id === "tematicas") {
          return {
            key: "suites_deluxe_tematicas",
            name: pricing.suites.suites_deluxe_tematicas.name,
            kind: "suite",
            entry: pricing.suites.suites_deluxe_tematicas,
          };
        }
        if (cat.id === "sencillas") {
          if (label.includes("amarte")) {
            return {
              key: "suite_amarte",
              name: pricing.suites.suite_amarte.name,
              kind: "suite",
              entry: pricing.suites.suite_amarte,
            };
          }
          return {
            key: "suite_cabana_o_movimiento",
            name: pricing.suites.suite_cabana_o_movimiento.name,
            kind: "suite",
            entry: pricing.suites.suite_cabana_o_movimiento,
          };
        }
      }
    }
  }

  return null;
}

/**
 * @param {Record<string, number>} weekday
 * @param {Record<string, number>} weekend
 * @param {"suite"|"plan"} kind
 */
function availableDurationsFromBands(weekday, weekend, kind) {
  /** @type {string[]} */
  const labels = [];
  const order =
    kind === "plan"
      ? [
          ["h6", "6 horas"],
          ["h12", "12 horas"],
          ["diaHotelero", "día hotelero"],
        ]
      : [
          ["h4", "4 horas"],
          ["h8", "8 horas"],
          ["h12", "12 horas"],
          ["diaHotelero", "día hotelero"],
        ];
  const week = weekday || {};
  const end = weekend || {};
  for (const [key, label] of order) {
    if (Number(week[key]) > 0 || Number(end[key]) > 0) labels.push(label);
  }
  return labels;
}

/**
 * @param {{ suite?: string; date?: string; duration?: string }} input
 */
async function lookupCatalogPrice(input = {}) {
  const suite = typeof input.suite === "string" ? input.suite.trim() : "";
  const date = typeof input.date === "string" ? input.date.trim() : "";
  const durationRaw =
    typeof input.duration === "string" ? input.duration.trim() : "";

  const dateType = dateTypeFromIsoDate(date) || "weekday";
  const durationKey = normalizeDuration(durationRaw);

  const dbCatalog = await getRoomRatesCatalog();
  const dbEntry = findDbCatalogEntry(suite, dbCatalog);
  const resolvedName = dbEntry ? dbEntry.name : resolveTipo(suite);
  const resolvedKind = dbEntry
    ? dbEntry.kind
    : String(resolvedName || "").startsWith("Plan ")
      ? "plan"
      : "suite";
  const extras = await extrasForSuite(resolvedName, resolvedKind);
  const planRule = resolvedKind === "plan" ? ruleForPlan(resolvedName) : null;
  const suiteAdvice = planRule
    ? adviceForRule(planRule, dbCatalog, dateType, durationKey)
    : null;

  if (dbEntry) {
    const availableDurations = availableDurationsFromBands(
      dbEntry.weekday,
      dbEntry.weekend,
      dbEntry.kind
    );

    if (!durationKey) {
      if (!availableDurations.length) {
        return unavailableQuote({
          found: true,
          suite: dbEntry.name,
          dateType,
          duration: durationRaw || null,
          extras,
          decorationIncluded: resolvedKind === "plan",
          suiteAdvice,
        });
      }
      return {
        found: true,
        suite: dbEntry.name,
        dateType,
        duration: durationRaw || null,
        priceCop: null,
        spokenPrice: null,
        formattedPrice: null,
        availableDurations,
        bookingUrl: contact.reservationsUrl,
        whatsappUrl: contact.whatsappUrl,
        source: "supabase",
        extras,
        decorationIncluded: resolvedKind === "plan",
          suiteAdvice,
        message:
          "Indica la duración (4, 8, 12 horas o día hotelero; planes: 6, 12 o día hotelero).",
      };
    }

    const band = dbEntry[dateType] || {};
    const priceCop = band[durationKey];
    const amount = Number(priceCop);
    if (!(amount > 0)) {
      return unavailableQuote({
        found: true,
        suite: dbEntry.name,
        dateType,
        duration: durationRaw,
        availableDurations,
        extras,
        decorationIncluded: resolvedKind === "plan",
          suiteAdvice,
      });
    }

    return {
      found: true,
      suite: dbEntry.name,
      dateType,
      duration: durationRaw,
      priceCop: amount,
      spokenPrice: toSpokenPrice(amount),
      formattedPrice: formatCop(amount),
      availableDurations,
      bookingUrl: contact.reservationsUrl,
      whatsappUrl: contact.whatsappUrl,
      source: "supabase",
      extras,
      decorationIncluded: resolvedKind === "plan",
          suiteAdvice,
      message: null,
    };
  }

  const aliasLanding = resolveLandingByAlias(suite);
  if (aliasLanding && aliasLanding.suites.length) {
    const names = aliasLanding.suites.map((item) => item.roomTypeName);
    let groupExtras = null;
    try {
      const catalog = await getRoomExtrasCatalog();
      groupExtras = extrasApplicableToNames(
        names,
        catalog instanceof Map ? catalog : null
      );
    } catch (err) {
      console.warn(
        "[catalogLookup] room_extras:",
        err && err.message ? err.message : err
      );
      groupExtras = null;
    }
    const quotedSuites = names.map((name) => {
      const entry = dbCatalog instanceof Map ? dbCatalog.get(name) : null;
      const band = entry && durationKey ? entry[dateType] || {} : null;
      const amount = band ? Number(band[durationKey]) : NaN;
      return { name, priceCop: amount > 0 ? amount : null };
    });
    return {
      found: true,
      suite: "Sauna Jacuzzi",
      dateType,
      duration: durationRaw || null,
      priceCop: null,
      spokenPrice: null,
      formattedPrice: null,
      availableDurations: [],
      bookingUrl: contact.reservationsUrl,
      whatsappUrl: contact.whatsappUrl,
      source: quotedSuites.some((row) => row.priceCop > 0) ? "supabase" : "unavailable",
      extras: groupExtras,
      suites: quotedSuites,
      decorationIncluded: false,
      message:
        "Sauna Jacuzzi son Suite Gold, Suite Rubí y Suite Zafiro. Cotiza cada suite con su fila de room_rates. No des un monto único para sauna.",
    };
  }

  return unavailableQuote({
    suite: resolvedName || suite || null,
    dateType: dateTypeFromIsoDate(date),
    duration: durationRaw || null,
    extras,
    decorationIncluded: resolvedKind === "plan",
          suiteAdvice,
  });
}

const UNAVAILABLE_MESSAGE =
  "No tengo esa tarifa ahora. Puedes dejarla en el formulario o escribir por WhatsApp y un asesor te confirma el monto.";

/**
 * @param {Record<string, unknown>} [partial]
 */
function unavailableQuote(partial = {}) {
  return {
    found: false,
    suite: null,
    dateType: null,
    duration: null,
    priceCop: null,
    spokenPrice: null,
    formattedPrice: null,
    availableDurations: [],
    bookingUrl: contact.reservationsUrl,
    whatsappUrl: contact.whatsappUrl,
    source: "unavailable",
    extras: null,
    decorationIncluded: false,
    suiteAdvice: null,
    message: UNAVAILABLE_MESSAGE,
    ...partial,
  };
}

/**
 * Suites del plan y, si room_rates tiene la celda, su precio. Sin fila, priceCop es null.
 * @param {{ mode: string; exclude: readonly string[]; suites: readonly string[] }} rule
 * @param {Map<string, any> | null} dbCatalog
 * @param {string} dateType
 * @param {string | null} durationKey
 */
function adviceForRule(rule, dbCatalog, dateType, durationKey) {
  return {
    mode: rule.mode,
    exclude: [...rule.exclude],
    suites: rule.suites.map((name) => {
      const landing = landingsForRoomTypes([name])[0] || null;
      const entry = dbCatalog instanceof Map ? dbCatalog.get(name) : null;
      const band = entry && durationKey ? entry[dateType] || {} : null;
      const amount = band ? Number(band[durationKey]) : NaN;
      return {
        name,
        landingId: landing ? landing.id : null,
        landingUrl: landing ? landing.url : null,
        priceCop: Number.isFinite(amount) && amount > 0 ? amount : null,
      };
    }),
  };
}

/**
 * Extras que aplican a esta suite. `null` si room_extras no respondió.
 * @param {string} roomName
 * @returns {Promise<Array<{ code: string; nombre: string; precio: number; appliesTo: string }> | null>}
 */
async function extrasForSuite(roomName, kind) {
  if (!roomName) return null;
  try {
    const extras = await getRoomExtrasCatalog();
    const rows = extrasApplicableToNames(
      [roomName],
      extras instanceof Map ? extras : null
    );
    if (!Array.isArray(rows) || kind !== "plan") return rows;
    return rows.filter((row) => row.appliesTo !== "*" && !isDecorationExtra(row));
  } catch (err) {
    console.warn(
      "[catalogLookup] room_extras:",
      err && err.message ? err.message : err
    );
    return null;
  }
}

/**
 * @param {readonly string[]} tipos
 * @param {readonly string[]} packs
 */
async function buildWidgetQuoteCatalog(tipos, packs) {
  /** @type {Record<string, { weekday: Record<string, number>; weekend: Record<string, number>; availablePacks: string[] }>} */
  const byTipo = {};
  const tipoList = Array.isArray(tipos) ? tipos : [];
  const packList = Array.isArray(packs) ? packs : [];

  const dbCatalog = await getRoomRatesCatalog();

  for (const tipo of tipoList) {
    const tipoStr = String(tipo || "");
    /** @type {Record<string, number>} */
    const weekday = {};
    /** @type {Record<string, number>} */
    const weekend = {};

    const dbEntry = findDbCatalogEntry(tipoStr, dbCatalog);
    if (dbEntry) {
      for (const pack of packList) {
        const durationKey = normalizeDuration(String(pack || ""));
        if (!durationKey) continue;
        const w = dbEntry.weekday[durationKey];
        const e = dbEntry.weekend[durationKey];
        if (typeof w === "number" && w > 0) {
          weekday[pack] = w;
        }
        if (typeof e === "number" && e > 0) {
          weekend[pack] = e;
        }
      }
    }

    const availablePacks = packList.filter(
      (p) => weekday[p] != null || weekend[p] != null
    );
    if (!availablePacks.length) continue;
    byTipo[tipo] = { weekday, weekend, availablePacks };
  }

  return {
    byTipo,
    source: dbCatalog ? "supabase" : "unavailable",
  };
}

module.exports = {
  lookupCatalogPrice,
  findCatalogEntry,
  normalizeDuration,
  toSpokenPrice,
  numberToSpanishWords,
  buildWidgetQuoteCatalog,
};
