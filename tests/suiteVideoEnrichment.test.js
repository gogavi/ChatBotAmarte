const assert = require("assert");
const {
  getSuiteVideoByLabel,
  getSuiteVideoByProductUrl,
  getSuiteVideosForWidget,
} = require("../config/amarteCatalog");
const {
  enrichChatReply,
  sanitizeProductLinksInReply,
  ensurePromoBlockOnExactQuote,
} = require("../services/suiteChatEnrichment");
const { formatQuoteWithPaymentOptions } = require("../reservationService");

const jacuzzi = getSuiteVideoByLabel("suite_vip_jacuzzi");
assert.ok(jacuzzi);
assert.strictEqual(jacuzzi.title, "Suite VIP Jacuzzi");
assert.ok(jacuzzi.videoUrl.includes("SUITE%20VIP%20JACUZZI.mp4"));

const byUrl = getSuiteVideoByProductUrl(
  "https://amartesuite.com/producto/suite-vip-jacuzzi/"
);
assert.ok(byUrl);
assert.strictEqual(byUrl.id, "suite_vip_jacuzzi");

const widgetList = getSuiteVideosForWidget();
assert.ok(widgetList.length >= 10);
assert.ok(widgetList.every((s) => s.videoUrl && s.productUrl && s.title));

const sanitized = sanitizeProductLinksInReply(
  "Mira [Ver ficha](https://amartesuite.com/producto/suite-vip-jacuzzi/) por favor"
);
assert.ok(sanitized.text.includes("Ver video de la Suite VIP Jacuzzi"));
assert.ok(!sanitized.text.includes("amartesuite.com/producto"));
assert.ok(sanitized.suiteVideo);
assert.strictEqual(sanitized.suiteVideo.id, "suite_vip_jacuzzi");

const promo = formatQuoteWithPaymentOptions(240000);
assert.ok(promo.includes("DESCUENTO ESPECIAL"));
assert.ok(promo.includes("$120.000"));
assert.ok(promo.includes("$180.000"));

const withPromo = ensurePromoBlockOnExactQuote(
  "**Suite VIP Jacuzzi** · 8 h · domingo–jueves: **$240.000**"
);
assert.ok(withPromo.includes("DESCUENTO ESPECIAL"));
assert.ok(withPromo.includes("Valor a pagar"));
assert.ok(withPromo.includes("## 🔥"));
assert.ok(withPromo.includes("## 💎"));

const packList = ensurePromoBlockOnExactQuote(
  [
    "**Suite Diamante** — máximo lujo",
    "Domingo–jueves:",
    "- 4 h: **$200.000**",
    "- 8 h: **$230.000**",
    "- 12 h: **$280.000**",
    "- Día hotelero: **$350.000**",
  ].join("\n")
);
assert.ok(!packList.includes("DESCUENTO ESPECIAL"));

const jacuzziPromoQuote = ensurePromoBlockOnExactQuote(
  "**Promo Jacuzzi** — 4 horas: **$150.000**. Incluye jacuzzi ilimitado + 2 Mimosas."
);
assert.ok(!jacuzziPromoQuote.includes("DESCUENTO ESPECIAL"));
assert.ok(!jacuzziPromoQuote.includes("25% OFF"));

const enriched = enrichChatReply(
  "Te recomiendo [Suite VIP Jacuzzi](https://amartesuite.com/producto/suite-vip-jacuzzi/).\n**Suite VIP Jacuzzi** · 8 h · domingo–jueves: **$240.000**",
  "suite_vip_jacuzzi"
);
assert.ok(enriched.suiteVideo);
assert.ok(enriched.reply.includes("DESCUENTO ESPECIAL"));
assert.ok(!enriched.reply.includes("amartesuite.com/producto"));

console.log("suiteVideo enrichment tests passed");
