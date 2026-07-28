const {
  getSuiteVideoByLabel,
  getSuiteVideoByProductUrl,
} = require("../config/amarteCatalog");
const { formatQuoteWithPaymentOptions } = require("../reservationService");

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
 * Si hay cotización exacta ($X.XXX) y aún no está el bloque promo, lo anexa.
 * @param {string} reply
 * @returns {string}
 */
function ensurePromoBlockOnExactQuote(reply) {
  const text = String(reply || "");
  if (!text.trim()) return text;
  if (/DESCUENTO ESPECIAL/i.test(text)) return text;
  if (/Pago total con 25%/i.test(text)) return text;

  // Cotización exacta típica: línea con duración/día y un monto en negrita o plano
  const exactQuote =
    /(\*\*[^*]+\*\*[^\n]*·[^\n]*\$[\d.]+)|((4|6|8|12)\s*h[^\n]*\$[\d.]+)|(D[ií]a hotelero[^\n]*\$[\d.]+)/i.test(
      text
    );
  if (!exactQuote) return text;

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
  ensurePromoBlockOnExactQuote,
  enrichChatReply,
};
