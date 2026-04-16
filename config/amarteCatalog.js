/**
 * Catálogo comercial de Amarte Suite — fuente de verdad para el prompt de Martina.
 * Actualiza precios y URLs aquí sin tocar la lógica del servidor.
 */

/** @typedef {{ label: string; url: string }} SuiteLink */

/** @type {{ id: string; emoji: string; title: string; description: string; suites: SuiteLink[] }[]} */
const suiteCategories = [
  {
    id: "deluxe",
    emoji: "✅",
    title: "Deluxe – Máximo lujo y confort",
    description: "Suites premium con máximo confort.",
    suites: [
      { label: "Suite Diamante", url: "https://amartesuite.com/producto/suite-deluxe-diamante/" },
      { label: "Suite Gold", url: "https://amartesuite.com/producto/suite-deluxe-gold/" },
      { label: "Suite Rubí", url: "https://amartesuite.com/producto/suite-deluxe-rubi/" },
      { label: "Suite Zafiro", url: "https://amartesuite.com/producto/suite-deluxe-zafiro/" },
    ],
  },
  {
    id: "tematicas",
    emoji: "🎭",
    title: "Temáticas – Diseños exclusivos",
    description: "Ambientes únicos para vivir una fantasía a medida.",
    suites: [
      { label: "Suite Árabe", url: "https://amartesuite.com/producto/suite-deluxe-arabe/" },
      { label: "Suite Gótica", url: "https://amartesuite.com/producto/suite-deluxe-gotica/" },
      { label: "Suite Queen", url: "https://amartesuite.com/producto/suite-deluxe-queen/" },
    ],
  },
  {
    id: "jacuzzi",
    emoji: "🛁",
    title: "Jacuzzi – Espacios íntimos con jacuzzi privado",
    description: "Privacidad y relajación con jacuzzi en la suite.",
    suites: [{ label: "Suite VIP Jacuzzi", url: "https://amartesuite.com/producto/suite-vip-jacuzzi/" }],
  },
  {
    id: "sencillas",
    emoji: "🏡",
    title: "Sencillas – Acogedoras, sin jacuzzi en suite",
    description: "Opciones íntimas y acogedoras para parejas.",
    suites: [
      { label: "Suite Cabaña", url: "https://amartesuite.com/producto/suite-cabana/" },
      { label: "Suite Movimiento", url: "https://amartesuite.com/producto/suite-cama-en-movimiento/" },
      { label: "Suite Amarte", url: "https://amartesuite.com/producto/suite-amarte/" },
    ],
  },
];

/** Precios en COP (número entero). weekday = domingo a jueves; weekend = viernes y sábado. */
const pricing = {
  suites: {
    suite_amarte: {
      name: "Suite Amarte",
      weekday: { h4: 90000, h8: 120000, h12: 160000, diaHotelero: 200000 },
      weekend: { h4: 120000, h8: 160000, h12: 220000, diaHotelero: 260000 },
    },
    suite_cabana_o_movimiento: {
      name: "Suite Cabaña o Suite Movimiento",
      weekday: { h4: 120000, h8: 160000, h12: 190000, diaHotelero: 240000 },
      weekend: { h4: 150000, h8: 180000, h12: 260000, diaHotelero: 320000 },
    },
    suite_jacuzzi: {
      name: "Suite VIP Jacuzzi",
      weekday: { h4: 200000, h8: 240000, h12: 300000, diaHotelero: 380000 },
      weekend: { h4: 240000, h8: 290000, h12: 360000, diaHotelero: 420000 },
    },
    suites_deluxe_tematicas: {
      name: "Suite Temática (Jacuzzi + Sauna)",
      weekday: { h4: 240000, h8: 280000, h12: 340000, diaHotelero: 420000 },
      weekend: { h4: 300000, h8: 350000, h12: 420000, diaHotelero: 470000 },
    },
  },
  plans: {
    plan_amarte: {
      name: "Plan Amarte",
      weekday: { h6: 180000, h12: 240000, diaHotelero: 270000 },
      weekend: { h6: 200000, h12: 280000, diaHotelero: 320000 },
    },
    plan_cabana_movimiento: {
      name: "Plan Cabaña o Plan Cama Movimiento",
      weekday: { h6: 200000, h12: 260000, diaHotelero: 300000 },
      weekend: { h6: 220000, h12: 320000, diaHotelero: 370000 },
    },
    plan_humedo: {
      name: "Plan Húmedo",
      weekday: { h6: 300000, h12: 370000, diaHotelero: 440000 },
      weekend: { h6: 320000, h12: 420000, diaHotelero: 470000 },
    },
    plan_romantico_cumple_erotico: {
      name: "Plan Romántico / Cumpleaños / Erótico",
      weekday: { h6: 320000, h12: 400000, diaHotelero: 470000 },
      weekend: { h6: 370000, h12: 470000, diaHotelero: 520000 },
    },
  },
};

const identity = {
  name: "Martina",
  hotel: "Hotel Amarte Suite",
  siteUrl: "https://amartesuite.com",
  tone:
    "Cálida, encantadora, profesional, cercana, persuasiva, sensual y atractiva, sin vulgaridad. Respuestas cortas y convincentes.",
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
  note: "El proceso de reserva es ágil y seguro.",
};

const location = {
  address: "Calle 62 No. 14–19, Teusaquillo, Bogotá, Colombia",
  mapsUrl: "https://bit.ly/ubicacionAmarte",
};

const payment = {
  label: "Pago seguro (total o abono del 50%)",
  checkoutUrl: "https://checkout.wompi.co/l/VPOS_RXJqnz",
};

const contact = {
  whatsappUrl: "https://wa.me/573007416683",
  reservationsUrl: "https://amartesuite.com/reservas",
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
  lines.push("");
  lines.push("— SUITES (por duración) —");
  for (const key of Object.keys(pricing.suites)) {
    const s = pricing.suites[key];
    lines.push(`• ${s.name}`);
    lines.push(
      `  Domingo–Jueves: 4 h ${formatCop(s.weekday.h4)} | 8 h ${formatCop(s.weekday.h8)} | 12 h ${formatCop(s.weekday.h12)} | Día hotelero ${formatCop(s.weekday.diaHotelero)}`
    );
    lines.push(
      `  Viernes–Sábado: 4 h ${formatCop(s.weekend.h4)} | 8 h ${formatCop(s.weekend.h8)} | 12 h ${formatCop(s.weekend.h12)} | Día hotelero ${formatCop(s.weekend.diaHotelero)}`
    );
    lines.push("");
  }
  lines.push("— PLANES (por duración; incluyen experiencia según plan) —");
  for (const key of Object.keys(pricing.plans)) {
    const p = pricing.plans[key];
    lines.push(`• ${p.name}`);
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
 * Lista categorías y enlaces de suites para el prompt.
 */
function formatSuiteCategoriesForPrompt() {
  const blocks = [];
  for (const cat of suiteCategories) {
    const suiteLines = cat.suites.map((s) => `  - ${s.label}: ${s.url}`).join("\n");
    blocks.push(`${cat.emoji} ${cat.title}`);
    blocks.push(cat.description);
    blocks.push(suiteLines);
    blocks.push("");
  }
  return blocks.join("\n");
}

module.exports = {
  suiteCategories,
  pricing,
  identity,
  highlightedServices,
  reservationFlow,
  location,
  payment,
  contact,
  formatCop,
  formatPricingForPrompt,
  formatSuiteCategoriesForPrompt,
};
