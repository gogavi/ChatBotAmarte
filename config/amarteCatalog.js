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

/**
 * Nombres e includes. Los montos viven en Supabase `room_rates`.
 * Esta tabla no tiene weekday ni weekend.
 */
const pricing = {
  suites: {
    suite_amarte: {
      name: "Suite Amarte",
    },
    suite_cabana_o_movimiento: {
      name: "Suite Cabaña o Suite Movimiento",
    },
    suite_jacuzzi: {
      name: "Suite VIP Jacuzzi",
    },
    suites_deluxe_tematicas: {
      name: "Suites Deluxe o Temáticas",
    },
  },
  plans: {
    plan_amarte: {
      name: "Plan Amarte",
    },
    plan_cabana_movimiento: {
      name: "Plan Cabaña o Plan Cama Movimiento",
    },
    plan_humedo: {
      name: "Plan Húmedo",
    },
    plan_romantico_cumple_erotico: {
      name: "Plan Romántico / Cumpleaños / Erótico",
    },
  },
};

/**
 * Promo Jacuzzi. `price` es la tarifa de esas horas en la landing promo-suite-jacuzzi.
 * En las demás landings no se cita: ahí manda room_rates.
 * También clasifica la prerreserva para no apilar el 25%.
 */
const promoJacuzzi = Object.freeze({
  name: "Promo Jacuzzi",
  price: 150000,
  hours: 4,
  includes: "Uso ilimitado de Jacuzzi durante 4 horas + 2 Mimosas (cócteles de bienvenida)",
  url: "https://promojacuzzi.amartesuite.com",
});

/** Texto del montaje. El valor, si existe, está en room_rates. */
const decorationFees = Object.freeze({
  includes:
    "Arreglo con pétalos de rosa, globos con frases románticas, velas decorativas, lencería especial y ambiente preparado",
});

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
  "Hola, estuve charlando con Martina IA en Amarte Suite y quiero más información. ¿Me pueden ayudar?";

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
  decorationFees,
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
  formatSuiteCategoriesForPrompt,
  GENERATED_VIDEOS_BASE,
  buildSuiteVideoUrl,
  getSuiteVideoByProductUrl,
  getSuiteVideoByLabel,
  getSuiteVideosForWidget,
};
