/**
 * Catálogo de tarifas desde Supabase `room_rates` (SSOT).
 * Caché in-memory con TTL; fallback a null si Supabase no está disponible.
 */

const { getSupabase, isSupabaseConfigured } = require("../supabaseClient");
const { resolveTipo, VALID_TIPOS } = require("../reservationService");

const CACHE_TTL_MS = 5 * 60 * 1000;

/** @typedef {"h4"|"h6"|"h8"|"h12"|"diaHotelero"} DurationKey */

/** @type {Map<string, { name: string; kind: "suite"|"plan"; weekday: Record<string, number>; weekend: Record<string, number> }> | null} */
let cacheByName = null;
/** @type {number} */
let cacheLoadedAt = 0;
/** @type {Promise<Map<string, any> | null> | null} */
let inflight = null;
/** Cuando true, getRoomRatesCatalog no llama a Supabase (tests). */
let cacheDisabled = false;

/** @type {Map<string, { code: string; nombre: string; precio: number; appliesTo: string; activo: true }> | null} */
let extrasByCode = null;
/** @type {number} */
let extrasLoadedAt = 0;
/** @type {Promise<Map<string, any> | null> | null} */
let extrasInflight = null;
/** Cuando true, getRoomExtrasCatalog no llama a Supabase (tests). */
let extrasDisabled = false;

/**
 * @param {number} hours
 * @returns {DurationKey | null}
 */
function hoursToDurationKey(hours) {
  const h = Number(hours);
  if (h === 4) return "h4";
  if (h === 6) return "h6";
  if (h === 8) return "h8";
  if (h === 12) return "h12";
  if (h === 24) return "diaHotelero";
  return null;
}

/**
 * @param {string} dayName
 * @param {string[] | null} days
 */
function isWeekendDayCategory(dayName, days) {
  if (String(dayName || "").toLowerCase().includes("viernes")) return true;
  if (!days?.length) return false;
  return days.includes("Viernes") || days.includes("Sábado");
}

/**
 * @param {string} roomName
 * @returns {"suite"|"plan"|null}
 */
function kindFromRoomName(roomName) {
  if (roomName.startsWith("Suite ")) return "suite";
  if (roomName.startsWith("Plan ")) return "plan";
  return null;
}

/**
 * @returns {Promise<Map<string, {
 *   name: string;
 *   kind: "suite"|"plan";
 *   weekday: Record<string, number>;
 *   weekend: Record<string, number>;
 * }> | null>}
 */
async function fetchRoomRatesFromSupabase() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const sb = getSupabase();
  if (!sb) {
    return null;
  }

  const { data, error } = await sb
    .from("room_rates")
    .select(
      `
      price,
      room_types!inner (
        id,
        name,
        active
      ),
      rate_types!inner (
        id,
        name,
        hours,
        active
      ),
      day_categories!inner (
        id,
        name,
        days
      )
    `
    );

  if (error) {
    console.warn("[roomRatesCatalog] fetch error:", error.message || error);
    return null;
  }

  /** @type {Map<string, { name: string; kind: "suite"|"plan"; weekday: Record<string, number>; weekend: Record<string, number> }>} */
  const byName = new Map();
  const rows = Array.isArray(data) ? data : [];

  for (const row of rows) {
    const room = row.room_types;
    const rate = row.rate_types;
    const day = row.day_categories;
    if (!room || !rate || !day) continue;
    if (room.active === false || rate.active === false) continue;

    const kind = kindFromRoomName(String(room.name || ""));
    if (!kind) continue;

    const durationKey = hoursToDurationKey(rate.hours);
    if (!durationKey) continue;

    const price = Math.round(Number(row.price));
    if (!Number.isFinite(price) || price <= 0) continue;

    let entry = byName.get(room.name);
    if (!entry) {
      entry = {
        name: room.name,
        kind,
        weekday: {},
        weekend: {},
      };
      byName.set(room.name, entry);
    }

    if (isWeekendDayCategory(day.name, day.days)) {
      entry.weekend[durationKey] = price;
    } else {
      entry.weekday[durationKey] = price;
    }
  }

  return byName.size > 0 ? byName : null;
}

/**
 * Filas activas con precio > 0. Una fila inactiva o en cero no es cotizable.
 * @param {unknown} rows
 * @returns {Map<string, { code: string; nombre: string; precio: number; appliesTo: string; activo: true }>}
 */
function rowsToExtrasMap(rows) {
  /** @type {Map<string, { code: string; nombre: string; precio: number; appliesTo: string; activo: true }>} */
  const map = new Map();
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    if (!row || row.activo === false) continue;
    const code = String(row.code || "").trim();
    if (!code) continue;
    const price = Math.round(Number(row.precio));
    if (!Number.isFinite(price) || price <= 0) continue;
    const nombre = String(row.nombre || code).trim() || code;
    map.set(code, {
      code,
      nombre,
      precio: price,
      appliesTo: String(row.applies_to || "").trim(),
      activo: true,
    });
  }
  return map;
}

/**
 * `null` si el catálogo no está. `[]` si está y ninguna fila aplica.
 * `applies_to` '*' vale para cualquier nombre. El resto es una lista
 * separada por comas de room types.
 * @param {readonly string[]} names
 * @param {ReadonlyMap<string, { appliesTo?: string }> | null} extras
 * @returns {Array<{ code: string; nombre: string; precio: number; appliesTo: string }> | null}
 */
function isDecorationExtra(row) {
  return String(row && row.code ? row.code : "").startsWith("decoracion_");
}

function extrasApplicableToNames(names, extras) {
  if (!(extras instanceof Map)) return null;
  const wanted = Array.isArray(names) ? names : [];
  /** @type {Array<{ code: string; nombre: string; precio: number; appliesTo: string }>} */
  const list = [];
  for (const row of extras.values()) {
    const scope = String(row.appliesTo || "").trim();
    if (scope === "*") {
      list.push(row);
      continue;
    }
    const targets = scope
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (targets.some((name) => wanted.includes(name))) list.push(row);
  }
  return list;
}

/**
 * @returns {Promise<Map<string, { code: string; nombre: string; precio: number; appliesTo: string; activo: true }> | null>}
 */
async function fetchRoomExtrasFromSupabase() {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("room_extras")
    .select("code,nombre,precio,applies_to,activo");
  if (error) {
    console.warn("[roomRatesCatalog] room_extras:", error.message || error);
    return null;
  }
  const map = rowsToExtrasMap(data);
  return map.size > 0 ? map : null;
}

/**
 * Misma TTL que room_rates. Un fallo deja el resultado en null:
 * Martina no conserva un monto de extras viejo ni inventa uno.
 * @returns {Promise<Map<string, any> | null>}
 */
function refreshExtras() {
  if (extrasDisabled) return Promise.resolve(extrasByCode);
  const now = Date.now();
  if (extrasByCode && now - extrasLoadedAt < CACHE_TTL_MS) {
    return Promise.resolve(extrasByCode);
  }
  if (extrasInflight) return extrasInflight;
  extrasInflight = (async () => {
    try {
      const fresh = await fetchRoomExtrasFromSupabase();
      if (fresh) {
        extrasByCode = fresh;
        extrasLoadedAt = Date.now();
      }
      return fresh;
    } catch (err) {
      console.warn(
        "[roomRatesCatalog] room_extras:",
        err && err.message ? err.message : err
      );
      return null;
    }
  })();
  return extrasInflight.finally(() => {
    extrasInflight = null;
  });
}

/**
 * Invalida la caché (tests / refresh manual).
 */
function resetRoomRatesCache() {
  cacheByName = null;
  cacheLoadedAt = 0;
  inflight = null;
  cacheDisabled = false;
  extrasByCode = null;
  extrasLoadedAt = 0;
  extrasInflight = null;
  extrasDisabled = false;
}

/**
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<Map<string, {
 *   name: string;
 *   kind: "suite"|"plan";
 *   weekday: Record<string, number>;
 *   weekend: Record<string, number>;
 * }> | null>}
 */
async function getRoomRatesCatalog(opts = {}) {
  if (cacheDisabled) {
    return cacheByName;
  }
  const force = Boolean(opts.force);
  const now = Date.now();
  if (
    !force &&
    cacheByName &&
    now - cacheLoadedAt < CACHE_TTL_MS
  ) {
    return cacheByName;
  }

  if (!force && inflight) {
    return inflight;
  }

  inflight = (async () => {
    const [fresh] = await Promise.all([
      fetchRoomRatesFromSupabase(),
      refreshExtras(),
    ]);
    if (fresh) {
      cacheByName = fresh;
      cacheLoadedAt = Date.now();
    }
    return fresh;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * Resuelve consulta NL → entrada de BD.
 * @param {string} suiteQuery
 * @param {Map<string, any> | null} catalog
 * @returns {{ name: string; kind: "suite"|"plan"; weekday: Record<string, number>; weekend: Record<string, number> } | null}
 */
function findDbCatalogEntry(suiteQuery, catalog) {
  if (!catalog || !suiteQuery || typeof suiteQuery !== "string") {
    return null;
  }
  const q = suiteQuery.trim();
  if (!q) return null;

  const resolved = resolveTipo(q);
  if (resolved && catalog.has(resolved)) {
    return catalog.get(resolved);
  }

  const qNorm = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const [name, entry] of catalog.entries()) {
    const nameNorm = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (
      nameNorm === qNorm ||
      nameNorm.includes(qNorm) ||
      qNorm.includes(nameNorm) ||
      qNorm.includes(nameNorm.replace(/^suite\s+/, "")) ||
      qNorm.includes(nameNorm.replace(/^plan\s+/, ""))
    ) {
      return entry;
    }
  }

  // Match parcial contra VALID_TIPOS (p.ej. "Diamante" → Suite Diamante)
  for (const tipo of VALID_TIPOS) {
    const tipoNorm = tipo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const short = tipoNorm.replace(/^suite\s+/, "").replace(/^plan\s+/, "");
    if (
      qNorm === short ||
      qNorm.includes(short) ||
      short.includes(qNorm)
    ) {
      if (catalog.has(tipo)) {
        return catalog.get(tipo);
      }
    }
  }

  return null;
}

/**
 * Inyecta un catálogo mock (solo tests).
 * `null` desactiva Supabase. El lookup no inventa un monto.
 * @param {Map<string, any> | null} map
 */
function setRoomRatesCacheForTests(map) {
  inflight = null;
  if (map === null) {
    cacheByName = null;
    cacheLoadedAt = 0;
    cacheDisabled = true;
    return;
  }
  cacheDisabled = false;
  cacheByName = map;
  cacheLoadedAt = Date.now();
}

/**
 * @param {{ force?: boolean }} [opts]
 */
async function getRoomExtrasCatalog(opts = {}) {
  if (opts.force) {
    extrasLoadedAt = 0;
  }
  return refreshExtras();
}

/**
 * `null` deja los extras indisponibles (Martina no da monto).
 * @param {Map<string, any> | null} map
 */
function setRoomExtrasCacheForTests(map) {
  extrasInflight = null;
  extrasByCode = map;
  extrasLoadedAt = map ? Date.now() : 0;
  extrasDisabled = true;
}

module.exports = {
  getRoomRatesCatalog,
  getRoomExtrasCatalog,
  findDbCatalogEntry,
  resetRoomRatesCache,
  setRoomRatesCacheForTests,
  setRoomExtrasCacheForTests,
  rowsToExtrasMap,
  extrasApplicableToNames,
  isDecorationExtra,
  hoursToDurationKey,
  CACHE_TTL_MS,
};
