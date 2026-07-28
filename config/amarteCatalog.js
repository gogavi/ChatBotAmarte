/**
 * Catálogo comercial de Amarte Suite — fuente de verdad para el prompt de Martina.
 * Actualiza precios y URLs aquí sin tocar la lógica del servidor.
 */

const GENERATED_VIDEOS_BASE =
  "https://dftbelnombbtjryqphaa.supabase.co/storage/v1/object/public/generated-videos";

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   url: string;
 *   videoFile: string;
 * }} SuiteLink
 */

/**
 * @param {string} videoFile
 * @returns {string}
 */
function buildSuiteVideoUrl(videoFile) {
  const file = String(videoFile || "").trim();
  if (!file) return "";
  return `${GENERATED_VIDEOS_BASE}/${encodeURIComponent(file)}`;
}

/** @type {{ id: string; emoji: string; title: string; description: string; suites: SuiteLink[] }[]} */
const suiteCategories = [
  {
    id: "deluxe",
    emoji: "✅",
    title: "Deluxe – Máximo lujo y confort",
    description: "Suites premium con máximo confort.",
    suites: [
      {
        id: "suite_diamante",
        label: "Suite Diamante",
        url: "https://amartesuite.com/producto/suite-deluxe-diamante/",
        videoFile: "SUITE DELUXE DIAMANTE.mp4",
      },
      {
        id: "suite_gold",
        label: "Suite Gold",
        url: "https://amartesuite.com/producto/suite-deluxe-gold/",
        videoFile: "SUITE DELUXE GOLD.mp4",
      },
      {
        id: "suite_rubi",
        label: "Suite Rubí",
        url: "https://amartesuite.com/producto/suite-deluxe-rubi/",
        videoFile: "SUITE RUBI.mp4",
      },
      {
        id: "suite_zafiro",
        label: "Suite Zafiro",
        url: "https://amartesuite.com/producto/suite-deluxe-zafiro/",
        videoFile: "SUITE DELUXE ZAFIRO.mp4",
      },
    ],
  },
  {
    id: "tematicas",
    emoji: "🎭",
    title: "Temáticas – Diseños exclusivos",
    description: "Ambientes únicos para vivir una fantasía a medida.",
    suites: [
      {
        id: "suite_arabe",
        label: "Suite Árabe",
        url: "https://amartesuite.com/producto/suite-deluxe-arabe/",
        videoFile: "SUITE DELUXE ARABE.mp4",
      },
      {
        id: "suite_gotica",
        label: "Suite Gótica",
        url: "https://amartesuite.com/producto/suite-deluxe-gotica/",
        videoFile: "SUITE GOTICA.mp4",
      },
      {
        id: "suite_queen",
        label: "Suite Queen",
        url: "https://amartesuite.com/producto/suite-deluxe-queen/",
        videoFile: "SUITE DELUXE QUEEN.mp4",
      },
    ],
  },
  {
    id: "jacuzzi",
    emoji: "🛁",
    title: "Jacuzzi – Espacios íntimos con jacuzzi privado",
    description: "Privacidad y relajación con jacuzzi en la suite.",
    suites: [
      {
        id: "suite_vip_jacuzzi",
        label: "Suite VIP Jacuzzi",
        url: "https://amartesuite.com/producto/suite-vip-jacuzzi/",
        videoFile: "SUITE VIP JACUZZI.mp4",
      },
    ],
  },
  {
    id: "sencillas",
    emoji: "🏡",
    title: "Sencillas – Acogedoras, sin jacuzzi en suite",
    description: "Opciones íntimas y acogedoras para parejas.",
    suites: [
      {
        id: "suite_cabana",
        label: "Suite Cabaña",
        url: "https://amartesuite.com/producto/suite-cabana/",
        videoFile: "SUITE CABANA.mp4",
      },
      {
        id: "suite_movimiento",
        label: "Suite Movimiento",
        url: "https://amartesuite.com/producto/suite-cama-en-movimiento/",
        videoFile: "SUITE MOVIMIENTO.mp4",
      },
      {
        id: "suite_amarte",
        label: "Suite Amarte",
        url: "https://amartesuite.com/producto/suite-amarte/",
        videoFile: "SUITE AMARTE.mp4",
      },
    ],
  },
];

/** @returns {SuiteLink[]} */
function flattenSuites() {
  /** @type {SuiteLink[]} */
  const out = [];
  for (const cat of suiteCategories) {
    for (const suite of cat.suites) {
      out.push(suite);
    }
  }
  return out;
}

/**
 * @param {string} productUrl
 * @returns {{ id: string; title: string; videoUrl: string; productUrl: string } | null}
 */
function getSuiteVideoByProductUrl(productUrl) {
  const raw = String(productUrl || "").trim();
  if (!raw) return null;
  let pathname = "";
  try {
    pathname = new URL(raw).pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    pathname = raw.replace(/\/+$/, "").toLowerCase();
  }
  for (const suite of flattenSuites()) {
    let suitePath = "";
    try {
      suitePath = new URL(suite.url).pathname.replace(/\/+$/, "").toLowerCase();
    } catch {
      continue;
    }
    if (pathname === suitePath || pathname.endsWith(suitePath)) {
      return {
        id: suite.id,
        title: suite.label,
        videoUrl: buildSuiteVideoUrl(suite.videoFile),
        productUrl: suite.url,
      };
    }
  }
  return null;
}

/**
 * @param {string} nameOrId
 * @returns {{ id: string; title: string; videoUrl: string; productUrl: string } | null}
 */
function getSuiteVideoByLabel(nameOrId) {
  const raw = String(nameOrId || "").trim();
  if (!raw) return null;
  const needle = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  for (const suite of flattenSuites()) {
    const id = suite.id.toLowerCase();
    const label = suite.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (
      needle === id ||
      needle === label ||
      label.includes(needle) ||
      needle.includes(label.replace(/^suite\s+/, ""))
    ) {
      return {
        id: suite.id,
        title: suite.label,
        videoUrl: buildSuiteVideoUrl(suite.videoFile),
        productUrl: suite.url,
      };
    }
  }
  return null;
}

/**
 * Mapa para el widget: productUrl → video.
 * @returns {Array<{ id: string; title: string; productUrl: string; videoUrl: string }>}
 */
function getSuiteVideosForWidget() {
  return flattenSuites().map((suite) => ({
    id: suite.id,
    title: suite.label,
    productUrl: suite.url,
    videoUrl: buildSuiteVideoUrl(suite.videoFile),
  }));
}

/** Precios en COP (número entero). weekday = domingo a jueves; weekend = viernes y sábado. Matriz oficial V2. */
const pricing = {
  suites: {
    suite_amarte: {
      name: "Suite Amarte",
      weekday: { h4: 78000, h8: 100000, h12: 134000, diaHotelero: 165000 },
      weekend: { h4: 100000, h8: 134000, h12: 180000, diaHotelero: 220000 },
    },
    suite_cabana_o_movimiento: {
      name: "Suite Cabaña o Suite Movimiento",
      weekday: { h4: 100000, h8: 130000, h12: 160000, diaHotelero: 200000 },
      weekend: { h4: 120000, h8: 150000, h12: 220000, diaHotelero: 270000 },
    },
    suite_jacuzzi: {
      name: "Suite VIP Jacuzzi",
      weekday: { h4: 175000, h8: 200000, h12: 250000, diaHotelero: 320000 },
      weekend: { h4: 200000, h8: 240000, h12: 300000, diaHotelero: 350000 },
    },
    suites_deluxe_tematicas: {
      name: "Suites Deluxe o Temáticas",
      weekday: { h4: 200000, h8: 230000, h12: 280000, diaHotelero: 350000 },
      weekend: { h4: 250000, h8: 290000, h12: 350000, diaHotelero: 390000 },
    },
  },
  plans: {
    plan_amarte: {
      name: "Plan Amarte",
      includes: [
        { emoji: "🌹", label: "Pétalos de rosas" },
        { emoji: "🎈", label: "Globos" },
        { emoji: "🍾", label: "Champaña" },
        { emoji: "🍫", label: "Chocolates (2)" },
        { emoji: "🍿", label: "Crispetas (80gr)" },
      ],
      weekday: { h6: 180000, h12: 240000, diaHotelero: 270000 },
      weekend: { h6: 200000, h12: 280000, diaHotelero: 320000 },
    },
    plan_cabana_movimiento: {
      name: "Plan Cabaña o Plan Cama Movimiento",
      includes: [
        { emoji: "🌹", label: "Pétalos de rosas" },
        { emoji: "🎈", label: "Globos" },
        { emoji: "🍾", label: "Champaña" },
        { emoji: "🍫", label: "Chocolates (2)" },
        { emoji: "🍿", label: "Crispetas (80gr)" },
      ],
      weekday: { h6: 200000, h12: 260000, diaHotelero: 300000 },
      weekend: { h6: 220000, h12: 320000, diaHotelero: 370000 },
    },
    plan_humedo: {
      name: "Plan Húmedo",
      includes: [
        { emoji: "🌹", label: "Pétalos de rosas" },
        { emoji: "🎈", label: "Globos" },
        { emoji: "🍾", label: "Champaña" },
        { emoji: "🍫", label: "Chocolates (2)" },
        { emoji: "🍿", label: "Crispetas (80gr)" },
      ],
      weekday: { h6: 300000, h12: 370000, diaHotelero: 440000 },
      weekend: { h6: 320000, h12: 420000, diaHotelero: 470000 },
    },
    plan_romantico_cumple_erotico: {
      name: "Plan Romántico / Cumpleaños / Erótico",
      includes: [
        { emoji: "🌹", label: "Pétalos de rosas" },
        { emoji: "🎈", label: "Globos" },
        { emoji: "🎀", label: "Cintas" },
        { emoji: "🕯️", label: "Velas" },
        { emoji: "🍾", label: "Champaña" },
        { emoji: "🍫", label: "Chocolates (2)" },
        { emoji: "🍿", label: "Crispetas" },
        { emoji: "🛁", label: "Jacuzzi ilimitado" },
        { emoji: "♨️", label: "Sauna ilimitado (Plan Romántico)" },
      ],
      /** Extras solo cuando el usuario elige la variante Erótico */
      includesErotico: [
        { emoji: "🧴", label: "Body en malla" },
        { emoji: "🎭", label: "Antifaz" },
        { emoji: "⛓️", label: "Esposas" },
        { emoji: "🪢", label: "Látigo" },
        { emoji: "🛁", label: "Jacuzzi ilimitado" },
      ],
      weekday: { h6: 320000, h12: 400000, diaHotelero: 470000 },
      weekend: { h6: 370000, h12: 470000, diaHotelero: 520000 },
    },
  },
};

/** Promo estrella de pauta (prioridad al pedir jacuzzi / 4h). */
const promoJacuzzi = Object.freeze({
  name: "Promo Jacuzzi",
  price: 150000,
  hours: 4,
  includes: "Uso ilimitado de Jacuzzi durante 4 horas + 2 Mimosas (cócteles de bienvenida)",
  url: "https://promojacuzzi.amartesuite.com",
});

/** Persona adicional en suite (tarifas base son para 2). */
const extraPersonFee = 60000;

/** Decoración / celebraciones (adicional a la tarifa de suite). */
const decorationFees = Object.freeze({
  sencillasCabana: 100000,
  vipTematicasJacuzziSauna: 120000,
  includes:
    "Arreglo con pétalos de rosa, globos con frases románticas, velas decorativas, lencería especial y ambiente preparado",
});

/** Objeción de precio: hora suelta Suite Sencilla (venta interna). */
const simpleHourlyRate = 30000;

const bankAccounts = Object.freeze({
  bancolombia:
    "Bancolombia — Inversiones Ogavi S.A. — NIT 900112447-4 — Cta. Corriente 30089879630",
  davivienda:
    "Davivienda / Daviplata — Inversiones Ogavi S.A. — NIT 900112447-4 — Cta. Ahorros / N.º 008900659015",
  nequi: "Nequi (Envío a Banco) — misma cuenta Bancolombia 30089879630",
});

const identity = {
  name: "Martina",
  hotel: "Amarte Suite",
  siteUrl: "https://amartesuite.com",
  tone:
    "Súper cálida, empática, amable, profesional, cómplice y orientada al cierre rápido. Mensajes cortos, conversacionales, con emojis cálidos (✨🥂💖🛁🔥🛌🍾🎉🔞). Sin vulgaridad ni tono robótico.",
};

const highlightedServices = [
  "Planes románticos personalizados",
  "Sauna",
  "Jacuzzi",
  "Silla erótica",
  "Columpio",
  "Decoración para ocasiones especiales",
];

const reservationFlow = {
  steps: [
    "Fecha y hora de ingreso deseadas",
    "Tipo de suite o plan",
    "Pack de tiempo: 4 h, 8 h, 12 h o día hotelero (2:00 p. m. a 12:00 m. del día siguiente)",
  ],
  note: "El proceso de reserva es ágil y seguro. Prefiere el formulario inline del chat; no abrumes pidiendo muchos datos por texto.",
};

const location = {
  address: "Calle 62 #14-19, Chapinero (Calle 62 con Caracas), Bogotá, Colombia",
  mapsUrl: "https://bit.ly/ubicacionAmarte",
};

const payment = {
  label: "Pago seguro (total o abono del 50%)",
  checkoutUrl: "https://checkout.wompi.co/l/VPOS_RXJqnz",
};

const WHATSAPP_PHONE = "573007416683";
const whatsappDefaultMessage =
  "Hola, estuve navegando en la página web y descubrí habitaciones muy interesantes. ¿Me ayudas con más información?";

/**
 * @param {string} [message]
 */
function buildWhatsAppUrl(message) {
  const text = message || whatsappDefaultMessage;
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
}

const contact = {
  whatsappUrl: buildWhatsAppUrl(),
  reservationsUrl: "https://reservas.amartesuite.com",
  /** Landing principal de campañas / promociones (botón PROMOCIONES en el widget). */
  promotionsUrl: "https://promojacuzzi.amartesuite.com",
};

/**
 * Formatea un número COP para el prompt (ej. 78000 -> "$78.000").
 * @param {number} n
 */
function formatCop(n) {
  return `$${Number(n).toLocaleString("es-CO")}`;
}

/**
 * Serializa la tabla de precios como texto legible para el modelo.
 */
function formatPricingForPrompt() {
  const lines = [];
  lines.push("TARIFAS (COP Colombia). Domingo a jueves = tarifa entre semana. Viernes y sábado = tarifa fin de semana.");
  lines.push("Día hotelero: de 2:00 p. m. a 12:00 m. del día siguiente.");
  lines.push(
    `PROMO JACUZZI (pauta, prioridad si piden jacuzzi/4h): ${formatCop(promoJacuzzi.price)} por ${promoJacuzzi.hours} h — ${promoJacuzzi.includes}. Landing: botón PROMOCIONES del pie.`
  );
  lines.push(
    `Persona adicional: ${formatCop(extraPersonFee)}. Decoración: sencillas/cabaña +${formatCop(decorationFees.sencillasCabana)}; VIP/temáticas/jacuzzi/sauna +${formatCop(decorationFees.vipTematicasJacuzziSauna)}.`
  );
  lines.push(
    "IMPORTANTE: este bloque es referencia interna. NO copies al usuario el formato con | ni matrices densas; presenta precios según las reglas de «Presentación de precios» (desde / una línea / lista por viñetas)."
  );
  lines.push("");
  lines.push("— SUITES (por duración) —");
  for (const key of Object.keys(pricing.suites)) {
    const s = pricing.suites[key];
    lines.push(`• ${s.name}`);
    if (key === "suites_deluxe_tematicas") {
      lines.push(
        "  Aplica a: Suite Diamante, Gold, Rubí, Zafiro, Árabe, Gótica, Queen (misma tarifa)."
      );
    }
    if (key === "suite_cabana_o_movimiento") {
      lines.push("  Aplica a: Suite Cabaña y Suite Movimiento (misma tarifa).");
    }
    lines.push(
      `  Domingo–Jueves: 4 h ${formatCop(s.weekday.h4)} | 8 h ${formatCop(s.weekday.h8)} | 12 h ${formatCop(s.weekday.h12)} | Día hotelero ${formatCop(s.weekday.diaHotelero)}`
    );
    lines.push(
      `  Viernes–Sábado: 4 h ${formatCop(s.weekend.h4)} | 8 h ${formatCop(s.weekend.h8)} | 12 h ${formatCop(s.weekend.h12)} | Día hotelero ${formatCop(s.weekend.diaHotelero)}`
    );
    lines.push("");
  }
  lines.push("— PLANES (por duración; incluyen experiencia según plan) —");
  lines.push(
    "Al ofrecer o cotizar un plan, menciona siempre qué incluye (con emojis), en una línea corta o viñetas breves."
  );
  for (const key of Object.keys(pricing.plans)) {
    const p = pricing.plans[key];
    lines.push(`• ${p.name}`);
    if (Array.isArray(p.includes) && p.includes.length) {
      lines.push(
        `  Incluye: ${p.includes.map((i) => `${i.emoji} ${i.label}`).join(", ")}`
      );
    }
    if (Array.isArray(p.includesErotico) && p.includesErotico.length) {
      lines.push(
        `  Plan Erótico además incluye kit erótico: ${p.includesErotico.map((i) => `${i.emoji} ${i.label}`).join(", ")}`
      );
    }
    lines.push(
      `  Domingo–Jueves: 6 h ${formatCop(p.weekday.h6)} | 12 h ${formatCop(p.weekday.h12)} | Día hotelero ${formatCop(p.weekday.diaHotelero)}`
    );
    lines.push(
      `  Viernes–Sábado: 6 h ${formatCop(p.weekend.h6)} | 12 h ${formatCop(p.weekend.h12)} | Día hotelero ${formatCop(p.weekend.diaHotelero)}`
    );
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Lista categorías y suites para el prompt (sin URLs de ficha web: el video va por suiteShowcase).
 */
function formatSuiteCategoriesForPrompt() {
  const blocks = [];
  for (const cat of suiteCategories) {
    const suiteLines = cat.suites
      .map((s) => `  - ${s.label} (id: ${s.id})`)
      .join("\n");
    blocks.push(`${cat.emoji} ${cat.title}`);
    blocks.push(
      `Características de esta categoría (úsalas al presentar cualquier suite de la lista): ${cat.description}`
    );
    blocks.push(suiteLines);
    blocks.push("");
  }
  return blocks.join("\n");
}

module.exports = {
  suiteCategories,
  pricing,
  promoJacuzzi,
  extraPersonFee,
  decorationFees,
  simpleHourlyRate,
  bankAccounts,
  identity,
  highlightedServices,
  reservationFlow,
  location,
  payment,
  contact,
  buildWhatsAppUrl,
  whatsappDefaultMessage,
  formatCop,
  formatPricingForPrompt,
  formatSuiteCategoriesForPrompt,
  GENERATED_VIDEOS_BASE,
  buildSuiteVideoUrl,
  getSuiteVideoByProductUrl,
  getSuiteVideoByLabel,
  getSuiteVideosForWidget,
};
