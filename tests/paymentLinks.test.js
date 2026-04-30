const assert = require("assert");
const {
  PAYMENT_CHECKOUT_URL,
  normalizeAssistantPaymentLinks,
  normalizePaymentOptionUrl,
} = require("../paymentLinks");

assert.strictEqual(
  normalizeAssistantPaymentLinks(
    `Puedes pagar aquí: [Pago seguro Wompi](${PAYMENT_CHECKOUT_URL})`
  ),
  `Puedes pagar aquí: Pago seguro Wompi: ${PAYMENT_CHECKOUT_URL}`
);

assert.strictEqual(
  normalizeAssistantPaymentLinks(
    "Paga en https://checkout.wompi.co/l/VPOS%3Cem%3ERXJqnz"
  ),
  `Paga en ${PAYMENT_CHECKOUT_URL}`
);

assert.strictEqual(
  normalizePaymentOptionUrl("https://checkout.wompi.co/l/VPOS<em>RXJqnz"),
  PAYMENT_CHECKOUT_URL
);

console.log("paymentLinks tests passed");
