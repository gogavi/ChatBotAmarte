const { payment } = require("./config/amarteCatalog");

const PAYMENT_CHECKOUT_URL = payment.checkoutUrl;
const WOMPI_PAYMENT_URL_PATTERN = String.raw`https:\/\/checkout\.wompi\.co\/l\/VPOS(?:_|%3[Cc]em%3[Ee]|%3[Cc]\/em%3[Ee]|<\/?em>|&lt;\/?em&gt;|&amp;lt;\/?em&amp;gt;)*RXJqnz(?:%3[Cc]\/em%3[Ee]|<\/em>|&lt;\/em&gt;|&amp;lt;\/em&amp;gt;)*`;
const WOMPI_PAYMENT_URL_RE = new RegExp(WOMPI_PAYMENT_URL_PATTERN, "gi");
const WOMPI_MARKDOWN_LINK_RE = new RegExp(
  String.raw`\[([^\]\n]+)\]\((${WOMPI_PAYMENT_URL_PATTERN})\)`,
  "gi"
);

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
    .replace(WOMPI_MARKDOWN_LINK_RE, (_, label) => {
      return `${label}: ${PAYMENT_CHECKOUT_URL}`;
    })
    .replace(WOMPI_PAYMENT_URL_RE, PAYMENT_CHECKOUT_URL);
}

module.exports = {
  PAYMENT_CHECKOUT_URL,
  normalizeAssistantPaymentLinks,
  normalizePaymentOptionUrl,
};
