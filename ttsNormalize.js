/**
 * Normaliza texto para síntesis de voz (ElevenLabs).
 * No altera el mensaje visible del chat: solo el payload TTS.
 */

const URL_RE = /https?:\/\/[^\s)\]>]+/gi;
const DURATION_RE = /\b(\d+)\s*(h|hr|hrs|hora|horas)\b/gi;
/** Montos: $90.000 | $90,000 | $90000 | $90.000 COP */
const MONEY_RE =
  /\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)(?:\s*(?:COP|pesos))?\b/gi;
const MIDDLE_DOT_RE = /\s*·\s*/g;
const EM_DASH_RE = /\s*[—–]\s*/g;

/**
 * Formatea un número capturado como monto para lectura en español CO.
 * @param {string} rawDigits
 */
function formatMoneyAmount(rawDigits) {
  const digits = String(rawDigits).replace(/[.,\s]/g, "");
  if (!digits || !/^\d+$/.test(digits)) {
    return rawDigits;
  }
  const n = Number(digits);
  if (!Number.isFinite(n)) {
    return rawDigits;
  }
  return `${n.toLocaleString("es-CO")} pesos`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeTextForTts(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  let s = text;

  // 1) URLs → mención breve (evita deletrear el enlace)
  s = s.replace(URL_RE, "enlace en el chat");

  // 2) Duraciones: 4 h / 4h / 8 hrs → N hora(s)
  s = s.replace(DURATION_RE, (_full, numStr) => {
    const n = parseInt(numStr, 10);
    if (n === 1) {
      return "1 hora";
    }
    return `${numStr} horas`;
  });

  // 3) Montos: $90.000 → 90.000 pesos
  s = s.replace(MONEY_RE, (_full, amount) => formatMoneyAmount(amount));

  // 4) Puntuación tipográfica → pausas naturales
  s = s.replace(MIDDLE_DOT_RE, ", ");
  s = s.replace(EM_DASH_RE, ", ");

  // Espacios duplicados
  s = s.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

module.exports = {
  normalizeTextForTts,
  formatMoneyAmount,
};
