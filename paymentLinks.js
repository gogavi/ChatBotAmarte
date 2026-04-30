const { payment } = require("./config/amarteCatalog");

const PAYMENT_CHECKOUT_URL = payment.checkoutUrl;
const WOMPI_PAYMENT_URL_PATTERN = String.raw`https:\/\/checkout\.wompi\.co\/l\/VPOS(?:_|%3[Cc]em%3[Ee]|%3[Cc]\/em%3[Ee]|<\/?em>|&lt;\/?em&gt;|&amp;lt;\/?em&amp;gt;)*RXJqnz(?:%3[Cc]\/em%3[Ee]|<\/em>|&lt;\/em&gt;|&amp;lt;\/em&amp;gt;)*`;
const WOMPI_PAYMENT_URL_RE = new RegExp(WOMPI_PAYMENT_URL_PATTERN, "gi");
const WOMPI_MARKDOWN_LINK_RE = new RegExp(
  String.raw`\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)`,
  "gi"
);

function isWompiCheckoutLabel(label) {
  return /pago\s+seguro\s+wompi/i.test(String(label || ""));
}

function normalizePaymentOptionUrl(url) {
  if (typeof url !== "string") {
    return "";
  }
  return url.replace(WOMPI_PAYMENT_URL_RE, PAYMENT_CHECKOUT_URL);
}

function normalizeAssistantPaymentLinks(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text
    .replace(WOMPI_MARKDOWN_LINK_RE, (full, label, url) => {
      if (isWompiCheckoutLabel(label) || WOMPI_PAYMENT_URL_RE.test(url)) {
        WOMPI_PAYMENT_URL_RE.lastIndex = 0;
        return `${label}: ${PAYMENT_CHECKOUT_URL}`;
      }
      WOMPI_PAYMENT_URL_RE.lastIndex = 0;
      return full;
    })
    .replace(WOMPI_PAYMENT_URL_RE, PAYMENT_CHECKOUT_URL);
}

module.exports = {
  PAYMENT_CHECKOUT_URL,
  normalizeAssistantPaymentLinks,
  normalizePaymentOptionUrl,
};
