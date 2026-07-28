const {
  getSuiteVideoByLabel,
  getSuiteVideoByProductUrl,
} = require("../config/amarteCatalog");
const { formatQuoteWithPaymentOptions, isPromoJacuzziQuoteText } = require("../reservationService");

const PRODUCT_MD_LINK_RE =
  /\[([^\]]+)\]\((https?:\/\/(?:www\.)?amartesuite\.com\/producto\/[^)\s]+)\)/gi;
const PRODUCT_BARE_URL_RE =
  /https?:\/\/(?:www\.)?amartesuite\.com\/producto\/[^\s)<>"']+/gi;

/**
 * @param {string} text
 * @returns {{ text: string; suiteVideo: { id: string; title: string; videoUrl: string } | null }}
 */
function sanitizeProductLinksInReply(text) {
  let suiteVideo = null;
  let out = String(text || "");

  out = out.replace(PRODUCT_MD_LINK_RE, (full, label, url) => {
    const resolved = getSuiteVideoByProductUrl(url);
    if (resolved && !suiteVideo) {
      suiteVideo = {
        id: resolved.id,
        title: resolved.title,
        videoUrl: resolved.videoUrl,
      };
    }
    const title = resolved ? resolved.title : String(label || "suite").trim();
    return `Ver video de la ${title}`;
  });

  out = out.replace(PRODUCT_BARE_URL_RE, (url) => {
    const resolved = getSuiteVideoByProductUrl(url);
    if (resolved && !suiteVideo) {
      suiteVideo = {
        id: resolved.id,
        title: resolved.title,
        videoUrl: resolved.videoUrl,
      };
    }
    if (resolved) {
      return `Ver video de la ${resolved.title}`;
    }
    return "";
  });

  return { text: out.replace(/\n{3,}/g, "\n\n").trim(), suiteVideo };
}

/**
 * @param {unknown} showcase
 * @returns {{ id: string; title: string; videoUrl: string } | null}
 */
function resolveSuiteVideoFromShowcase(showcase) {
  if (showcase == null) return null;
  const raw = String(showcase).trim();
  if (!raw) return null;
  const resolved = getSuiteVideoByLabel(raw);
  if (!resolved) return null;
  return {
    id: resolved.id,
    title: resolved.title,
    videoUrl: resolved.videoUrl,
  };
}

/**
 * Quita bloques de descuento (IA o canónicos) para reinsertar el formato oficial.
 * @param {string} text
 * @returns {string}
 */
function stripPaymentPromoBlocks(text) {
  let t = String(text || "");
  const markers = [
    /\n*##\s*[^\n]*DESCUENTO ESPECIAL[^\n]*/i,
    /\n*(?:🔥\s*)?¡?DESCUENTO ESPECIAL!?/i,
    /\n*##\s*[^\n]*[Qq]uieres ahorrar[^\n]*/i,
    /\n*¿?QUIERES AHORRAR AÚN MÁS\??/i,
    /\n*─{3,}/,
  ];
  let cut = -1;
  for (let i = 0; i < markers.length; i++) {
    const m = t.match(markers[i]);
    if (m && typeof m.index === "number") {
      cut = cut === -1 ? m.index : Math.min(cut, m.index);
    }
  }
  if (cut >= 0) {
    t = t.slice(0, cut);
  }
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Si hay cotización exacta, asegura el bloque canónico de abono/25% (con títulos ##).
 * Reemplaza versiones planas de la IA. No aplica a Promo Jacuzzi ni listas de packs.
 * @param {string} reply
 * @returns {string}
 */
function ensurePromoBlockOnExactQuote(reply) {
  let text = String(reply || "");
  if (!text.trim()) return text;

  // Promo Jacuzzi: no acumular; además limpia si la IA inventó descuentos
  if (isPromoJacuzziQuoteText(text)) {
    return stripPaymentPromoBlocks(text);
  }

  const packPriceLines =
    (text.match(/(4|6|8|12)\s*h[^\n]*\$[\d.]+/gi) || []).length +
    (text.match(/D[ií]a hotelero[^\n]*\$[\d.]+/gi) || []).length;
  // Lista de packs (varios precios): no anexar oferta de abono/25%.
  if (packPriceLines >= 2) return text;

  // Cotización exacta típica: una sola línea pack + monto
  const exactQuote =
    /(\*\*[^*]+\*\*[^\n]*·[^\n]*\$[\d.]+)|((4|6|8|12)\s*h[^\n]*\$[\d.]+)|(D[ií]a hotelero[^\n]*\$[\d.]+)/i.test(
      text
    );
  if (!exactQuote) return text;

  text = stripPaymentPromoBlocks(text);

  const amounts = [...text.matchAll(/\$\s*([\d.]+)/g)].map((m) =>
    parseInt(String(m[1]).replace(/\./g, ""), 10)
  );
  const total = amounts.find((n) => Number.isFinite(n) && n >= 50000);
  if (!total) return text;

  const promo = formatQuoteWithPaymentOptions(total);
  if (!promo) return text;
  return `${text.trim()}\n\n${promo}`;
}

/**
 * @param {string} reply
 * @param {unknown} suiteShowcase
 * @returns {{ reply: string; suiteVideo: { id: string; title: string; videoUrl: string } | null }}
 */
function enrichChatReply(reply, suiteShowcase) {
  const sanitized = sanitizeProductLinksInReply(reply);
  let suiteVideo =
    resolveSuiteVideoFromShowcase(suiteShowcase) || sanitized.suiteVideo;
  const withPromo = ensurePromoBlockOnExactQuote(sanitized.text);
  return { reply: withPromo, suiteVideo };
}

  module.exports = {
  sanitizeProductLinksInReply,
  resolveSuiteVideoFromShowcase,
  stripPaymentPromoBlocks,
  ensurePromoBlockOnExactQuote,
  enrichChatReply,
};
