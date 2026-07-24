const { getSupabase, isSupabaseConfigured } = require("./supabaseClient");
const { payment, formatCop } = require("./config/amarteCatalog");

/** Packs válidos en el SaaS (`rate_types`). */
const VALID_PACKS = Object.freeze([
  "Pack 4 horas",
  "Pack 6 horas",
  "Pack 8 horas",
  "Pack 12 horas",
  "Día Hotelero",
]);

/** Suites/planes canónicos en `room_types`. */
const VALID_TIPOS = Object.freeze([
  "Suite Amarte",
  "Suite Árabe",
  "Suite Cabaña",
  "Suite Diamante",
  "Suite Gamer",
  "Suite Gold",
  "Suite Gótica",
  "Suite Jacuzzi",
  "Suite Movimiento",
  "Suite Queen",
  "Suite Rubí",
  "Suite Sencilla",
  "Suite Zafiro",
  "Plan Amarte",
  "Plan Cabaña",
  "Plan Cama Movimiento",
  "Plan Cumpleaños",
  "Plan Erótico",
  "Plan Húmedo",
  "Plan Movimiento",
  "Plan Romántico",
]);

/** Alias marketing / chatbot → nombre SaaS. */
const TIPO_ALIASES = Object.freeze({
  "suite vip jacuzzi": "Suite Jacuzzi",
  "suite jacuzzi": "Suite Jacuzzi",
  "vip jacuzzi": "Suite Jacuzzi",
  "suite deluxe diamante": "Suite Diamante",
  "suite deluxe gold": "Suite Gold",
  "suite deluxe rubi": "Suite Rubí",
  "suite deluxe rubí": "Suite Rubí",
  "suite deluxe zafiro": "Suite Zafiro",
  "suite deluxe arabe": "Suite Árabe",
  "suite deluxe árabe": "Suite Árabe",
  "suite deluxe gotica": "Suite Gótica",
  "suite deluxe gótica": "Suite Gótica",
  "suite deluxe queen": "Suite Queen",
  "suite cama en movimiento": "Suite Movimiento",
  "suite cama movimiento": "Suite Movimiento",
  "plan cabaña o plan cama movimiento": "Plan Cabaña",
  "plan romantico": "Plan Romántico",
  "plan romántico": "Plan Romántico",
  "plan romantico / cumpleaños / erótico": "Plan Romántico",
  "plan húmedo": "Plan Húmedo",
  "plan humedo": "Plan Húmedo",
});

const PACK_ALIASES = Object.freeze({
  "4h": "Pack 4 horas",
  "4 h": "Pack 4 horas",
  "4 horas": "Pack 4 horas",
  "pack 4": "Pack 4 horas",
  "pack 4 horas": "Pack 4 horas",
  "6h": "Pack 6 horas",
  "6 h": "Pack 6 horas",
  "6 horas": "Pack 6 horas",
  "pack 6": "Pack 6 horas",
  "pack 6 horas": "Pack 6 horas",
  "8h": "Pack 8 horas",
  "8 h": "Pack 8 horas",
  "8 horas": "Pack 8 horas",
  "pack 8": "Pack 8 horas",
  "pack 8 horas": "Pack 8 horas",
  "12h": "Pack 12 horas",
  "12 h": "Pack 12 horas",
  "12 horas": "Pack 12 horas",
  "pack 12": "Pack 12 horas",
  "pack 12 horas": "Pack 12 horas",
  "dia hotelero": "Día Hotelero",
  "día hotelero": "Día Hotelero",
  "dia hotelero (2pm - 12md)": "Día Hotelero",
});

/**
 * @param {string} raw
 */
function normalizeKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * @param {string} raw
 * @returns {string | null}
 */
function resolveTipo(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  const exact = VALID_TIPOS.find((t) => t.toLowerCase() === trimmed.toLowerCase());
  if (exact) {
    return exact;
  }
  const alias = TIPO_ALIASES[normalizeKey(trimmed)];
  if (alias) {
    return alias;
  }
  // Match sin acentos
  const key = normalizeKey(trimmed);
  for (const t of VALID_TIPOS) {
    if (normalizeKey(t) === key) {
      return t;
    }
  }
  return null;
}

/**
 * @param {string} raw
 * @returns {string | null}
 */
function resolvePack(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  const exact = VALID_PACKS.find((p) => p.toLowerCase() === trimmed.toLowerCase());
  if (exact) {
    return exact;
  }
  return PACK_ALIASES[normalizeKey(trimmed)] || null;
}

/**
 * @param {string} raw
 * @returns {string | null} YYYY-MM-DD
 */
function resolveFecha(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(`${t}T12:00:00-05:00`);
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    return t;
  }
  return null;
}

/**
 * Normaliza hora a texto legible (p.ej. "2:00 PM" o "14:00").
 * @param {string} raw
 */
function resolveHora(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const t = raw.trim().slice(0, 32);
  if (!t) {
    return null;
  }
  return t;
}

/**
 * Precio como string numérico sin símbolos (como en el SaaS).
 * @param {unknown} raw
 */
function resolvePrecio(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return String(Math.round(raw));
  }
  if (typeof raw !== "string") {
    return null;
  }
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }
  return digits;
}

/**
 * @param {string} raw
 */
function resolveWhatsapp(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const digits = raw.replace(/[^\d+]/g, "").trim();
  if (digits.replace(/\D/g, "").length < 7) {
    return null;
  }
  return raw.trim().slice(0, 40);
}

/**
 * @param {unknown} payload
 * @returns {{ ok: true; data: Record<string, string> } | { ok: false; error: string }}
 */
function validatePendingPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload inválido" };
  }
  const p = /** @type {Record<string, unknown>} */ (payload);

  const nombre =
    typeof p.nombre === "string" && p.nombre.trim()
      ? p.nombre.trim().slice(0, 200)
      : null;
  const whatsapp = resolveWhatsapp(
    typeof p.whatsapp === "string" ? p.whatsapp : ""
  );
  const tipo = resolveTipo(typeof p.tipo === "string" ? p.tipo : "");
  const pack = resolvePack(typeof p.pack_tiempo === "string" ? p.pack_tiempo : "");
  const fecha = resolveFecha(
    typeof p.fecha_reserva === "string" ? p.fecha_reserva : ""
  );
  const hora = resolveHora(
    typeof p.hora_reserva === "string" ? p.hora_reserva : ""
  );
  const precio = resolvePrecio(p.precio);

  if (!nombre) {
    return { ok: false, error: "Falta el nombre del huésped" };
  }
  if (!whatsapp) {
    return { ok: false, error: "Falta un WhatsApp válido" };
  }
  if (!tipo) {
    return { ok: false, error: "Tipo de suite/plan no reconocido" };
  }
  if (!pack) {
    return { ok: false, error: "Pack de tiempo no reconocido" };
  }
  if (!fecha) {
    return { ok: false, error: "Fecha inválida (usa YYYY-MM-DD)" };
  }
  if (!hora) {
    return { ok: false, error: "Falta la hora de ingreso" };
  }
  if (!precio) {
    return { ok: false, error: "Falta el precio cotizado" };
  }

  const correo =
    typeof p.correo === "string" ? p.correo.trim().slice(0, 200) : "";
  const documento =
    typeof p.documento === "string" ? p.documento.trim().slice(0, 40) : "";
  if (!documento) {
    return { ok: false, error: "Falta el documento de identidad" };
  }

  const precioNum = parseInt(precio, 10);
  const abonoRaw =
    p.abono === undefined || p.abono === null || p.abono === ""
      ? String(Math.round(precioNum * 0.5))
      : resolvePrecio(p.abono) || "";

  return {
    ok: true,
    data: {
      nombre,
      whatsapp,
      correo,
      documento,
      tipo,
      pack_tiempo: pack,
      fecha_reserva: fecha,
      hora_reserva: hora,
      precio,
      abono: abonoRaw,
    },
  };
}

/**
 * Crea una prerreserva pendiente de pago en el SaaS.
 * @param {unknown} payload
 * @param {{ conversationId?: string | null }} [opts]
 * @returns {Promise<{ ok: true; id: string; row: Record<string, unknown> } | { ok: false; error: string }>}
 */
async function createPendingReservation(payload, opts = {}) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase no configurado" };
  }
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, error: "Cliente Supabase no disponible" };
  }

  const validated = validatePendingPayload(payload);
  if (!validated.ok) {
    return validated;
  }

  const conversationId =
    typeof opts.conversationId === "string" ? opts.conversationId : "";
  const trace = conversationId
    ? `conversation_id=${conversationId}`
    : "sin conversation_id";

  const row = {
    documento: validated.data.documento,
    nombre: validated.data.nombre,
    correo: validated.data.correo,
    whatsapp: validated.data.whatsapp,
    tipo: validated.data.tipo,
    suite: "—",
    fecha_reserva: validated.data.fecha_reserva,
    hora_reserva: validated.data.hora_reserva,
    pack_tiempo: validated.data.pack_tiempo,
    decoracion: "",
    tipo_plan: "Sin Decoración",
    mensaje: `Prerreserva creada por Martina (chat). ${trace}`,
    precio: validated.data.precio,
    abono: validated.data.abono,
    asesora: "Martina",
    canal: "Chatbot",
    modificado_por: "Chatbot",
    hotel_observations: `Pendiente de pago / asignación. ${trace}`,
    forma_pago: "Wompi",
    is_taken: false,
    estado_pago: "no_aplica",
    guest_client_type: "referido",
  };

  const { data, error } = await sb
    .from("reservations")
    .insert(row)
    .select("id, nombre, tipo, fecha_reserva, hora_reserva, pack_tiempo, precio, abono, canal, is_taken")
    .single();

  if (error) {
    console.error("createPendingReservation:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data.id, row: data };
}

/**
 * Primer nombre en mayúsculas para el saludo (ej. "John Doe" → "JOHN").
 * @param {unknown} nombre
 */
function firstNameUpper(nombre) {
  const raw = typeof nombre === "string" ? nombre.trim() : "";
  if (!raw) {
    return "HUÉSPED";
  }
  const first = raw.split(/\s+/)[0] || raw;
  return first.toLocaleUpperCase("es-CO");
}

/**
 * Mensaje post-prerreserva: abono 50% (+10% dto hotel) y pago total 25% dto.
 * @param {{ nombre?: unknown; precio?: unknown; abono?: unknown }} row
 * @returns {string}
 */
function buildPrereservaConfirmMessage(row) {
  const precioNum = parseInt(String(row?.precio ?? "").replace(/\D/g, ""), 10);
  const abonoNum = parseInt(String(row?.abono ?? "").replace(/\D/g, ""), 10);
  const total =
    Number.isFinite(precioNum) && precioNum > 0 ? precioNum : 0;
  const abono =
    Number.isFinite(abonoNum) && abonoNum > 0
      ? abonoNum
      : total > 0
        ? Math.round(total * 0.5)
        : 0;
  const totalConDto =
    total > 0 ? Math.round(total * 0.75) : 0;
  const name = firstNameUpper(row?.nombre);
  const checkoutUrl = payment.checkoutUrl;

  return [
    `Hola ${name},`,
    ``,
    `Tienes una pre-reserva con nosotros.`,
    `¿Quieres confirmarla?`,
    ``,
    `DESCUENTO ESPECIAL!`,
    `Separa tu reserva abonando el 50% (${formatCop(abono)})`,
    `y recibe un 10% de descuento adicional en el hotel.`,
    ``,
    `────────`,
    `¿QUIERES AHORRAR AÚN MÁS?`,
    `Pago total con 25% de descuento.`,
    `Valor a pagar: ${formatCop(totalConDto)}`,
    ``,
    `────────`,
    `Realiza el abono/pago aquí:`,
    checkoutUrl,
    ``,
    `Compártenos el comprobante al finalizar el abono/pago`,
  ].join("\n");
}

module.exports = {
  VALID_PACKS,
  VALID_TIPOS,
  resolveTipo,
  resolvePack,
  resolveFecha,
  resolvePrecio,
  validatePendingPayload,
  createPendingReservation,
  buildPrereservaConfirmMessage,
  firstNameUpper,
};
