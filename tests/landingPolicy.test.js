/**
 * Política de landing: tarifas de room_rates, redirección y sin prerreserva.
 * No abre red. La matriz V2 no entra en este camino.
 */
const assert = require("assert");
const { formatCop } = require("../config/amarteCatalog");
const { resolveLanding } = require("../config/landings");
const { setRoomRatesCacheForTests, resetRoomRatesCache } = require("../services/roomRatesCatalog");
const {
  beginLandingTurn,
  beginPriceTurn,
  clampLandingReservation,
  finishLandingReply,
  formatLandingPriceBlock,
  stripUntrustedCopAmounts,
} = require("../services/landingPolicy");

function entry(name, weekday, weekend) {
  return { name, kind: "suite", weekday, weekend };
}

const tematicasRates = new Map([
  [
    "Suite Árabe",
    entry("Suite Árabe", { h4: 240000, h8: 280000 }, { h4: 300000 }),
  ],
  ["Suite Queen", entry("Suite Queen", { h4: 240000 }, { h4: 300000 })],
  ["Suite Gótica", entry("Suite Gótica", { h12: 340000 }, {})],
  ["Suite Diamante", entry("Suite Diamante", { diaHotelero: 420000 }, {})],
]);

const tematicas = resolveLanding("tematicas");
const block = formatLandingPriceBlock(tematicas, tematicasRates);
assert.ok(block.includes("Suite Árabe"));
assert.ok(block.includes(formatCop(240000)));
assert.ok(block.includes(formatCop(300000)));
assert.ok(block.includes("Domingo–jueves"));
assert.ok(block.includes("Viernes–sábado"));
assert.ok(block.includes("Día hotelero"));
assert.ok(!block.includes("78.000"));
assert.ok(!block.includes("175.000"));

const missing = formatLandingPriceBlock(tematicas, null);
assert.match(missing, /no están disponibles|no inventes/i);
assert.ok(!missing.includes(formatCop(78000)));
assert.ok(!missing.includes("pricing"));

const promo = formatLandingPriceBlock(resolveLanding("promo-suite-jacuzzi"), null);
assert.match(promo, /no están disponibles|no inventes/i);
assert.ok(!promo.includes("150.000"));
assert.ok(!promo.includes(formatCop(150000)));

const scrubbed = stripUntrustedCopAmounts(
  `Lista ${formatCop(240000)} y promo ${formatCop(150000)} y hora ${formatCop(30000)}.`
);
assert.ok(!scrubbed.includes(formatCop(240000)));
assert.ok(!scrubbed.includes(formatCop(150000)));
assert.ok(!scrubbed.includes(formatCop(30000)));
assert.ok(scrubbed.includes("tarifa no disponible"));
const keptRate = stripUntrustedCopAmounts(
  `Árabe ${formatCop(240000)}.`,
  new Set([240000])
);
assert.ok(keptRate.includes(formatCop(240000)));

const decorationCollision = stripUntrustedCopAmounts(
  `deco ${formatCop(100000)} y ${formatCop(120000)} y vale 175.000 pesos`
);
assert.ok(!decorationCollision.includes("100.000"));
assert.ok(!decorationCollision.includes("120.000"));
assert.ok(!decorationCollision.includes("175.000"));

const jacuzzi = resolveLanding("suite-jacuzzi");
const redirected = finishLandingReply(
  { landing: jacuzzi, pricesAvailable: true, addendum: "x" },
  "Te cuento la Suite Gamer con calma.",
  "quiero ver la suite gamer"
);
assert.ok(
  redirected.includes(
    "[Suite Gamer](https://microservicio-suite-gamer.vercel.app)"
  )
);
assert.ok(!redirected.includes("/producto/"));

const samePage = finishLandingReply(
  { landing: jacuzzi, pricesAvailable: true, addendum: "x" },
  "Esta es la Suite Jacuzzi.",
  "qué incluye la suite jacuzzi"
);
assert.ok(!samePage.includes("microservicio-suite-jacuzzi.vercel.app"));

const toPromo = finishLandingReply(
  { landing: jacuzzi, pricesAvailable: true, addendum: "x" },
  "La promo es aparte.",
  "quiero la promo jacuzzi"
);
assert.ok(
  toPromo.includes(
    "[Promo Suite Jacuzzi](https://microservicio-promo-suite-jacuzzi.vercel.app)"
  )
);

const inventedUrl = finishLandingReply(
  { landing: jacuzzi, pricesAvailable: true, addendum: "x" },
  "Mira https://evil.vercel.app/trampa y https://amartesuite.com/producto/suite-vip-jacuzzi/",
  "hola"
);
assert.ok(!inventedUrl.includes("evil.vercel.app"));
assert.ok(!inventedUrl.includes("/producto/"));

const failed = finishLandingReply(
  { landing: jacuzzi, pricesAvailable: false, addendum: "x" },
  `Sale en ${formatCop(240000)}.`,
  "precio"
);
assert.ok(!failed.includes(formatCop(240000)));
assert.ok(failed.includes("tarifa no disponible"));

const collided = finishLandingReply(
  { landing: jacuzzi, pricesAvailable: false, addendum: "x" },
  `Suite Amarte 8 h: ${formatCop(100000)}. Cabaña: ${formatCop(150000)}. vale 175.000 pesos.`,
  "precio"
);
assert.ok(!collided.includes("100.000"));
assert.ok(!collided.includes("150.000"));
assert.ok(!collided.includes("175.000"));

const promoDown = finishLandingReply(
  { landing: resolveLanding("promo-suite-jacuzzi"), pricesAvailable: false, addendum: "x" },
  `Suite Cabaña ${formatCop(150000)}.`,
  "precio"
);
assert.ok(!promoDown.includes(`Suite Cabaña ${formatCop(150000)}`));
assert.ok(!promoDown.includes("150.000"));
assert.match(promoDown, /formulario|whatsapp/i);

const dirtyPath = finishLandingReply(
  { landing: jacuzzi, pricesAvailable: true, addendum: "x" },
  "Mira https://microservicio-suite-gamer.vercel.app/admin?x=1 y https://evil.vercel.app. y https://amartesuite.com/Producto/suite-vip-jacuzzi/ y https://microservicio-suite-jacuzzi.vercel.app.evil.com/phish",
  "quiero la suite gamer"
);
assert.ok(!dirtyPath.includes("/admin"));
assert.ok(!dirtyPath.includes("evil.vercel.app"));
assert.ok(!/producto/i.test(dirtyPath));
assert.ok(!dirtyPath.includes("vercel.app.evil.com"));
assert.ok(
  dirtyPath.includes("[Suite Gamer](https://microservicio-suite-gamer.vercel.app)")
);

const productionPath = finishLandingReply(
  { landing: jacuzzi, pricesAvailable: true, addendum: "x" },
  "Mira https://suitegamer.amartesuite.com/admin y https://suitegamer.amartesuite.com y https://amartesuite.com/",
  "hola"
);
assert.ok(!productionPath.includes("/admin"));
assert.ok(productionPath.includes("https://suitegamer.amartesuite.com"));
assert.ok(productionPath.includes("https://amartesuite.com/"));

const promoPage = finishLandingReply(
  { landing: resolveLanding("promo-suite-jacuzzi"), pricesAvailable: true, addendum: "x" },
  "Te hablo de la suite.",
  "qué incluye la suite jacuzzi"
);
assert.ok(!promoPage.includes("microservicio-suite-jacuzzi.vercel.app"));

const promoPhrase = finishLandingReply(
  { landing: resolveLanding("suite-gamer"), pricesAvailable: true, addendum: "x" },
  "ok",
  "quiero la promo suite jacuzzi"
);
assert.ok(promoPhrase.includes("https://microservicio-promo-suite-jacuzzi.vercel.app"));
assert.ok(!promoPhrase.includes("https://microservicio-suite-jacuzzi.vercel.app"));

const flags = clampLandingReservation(
  { landing: jacuzzi, pricesAvailable: true, addendum: "x" },
  {
    showReservationForm: true,
    showDateTimePicker: true,
    pendingReservation: { tipo: "Suite Jacuzzi" },
    formPrefill: { tipo: "Suite Jacuzzi" },
  }
);
assert.strictEqual(flags.showReservationForm, false);
assert.strictEqual(flags.showDateTimePicker, false);
assert.strictEqual(flags.pendingReservation, null);
assert.strictEqual(flags.formPrefill, null);

const siteFlags = clampLandingReservation(
  { landing: null, pricesAvailable: true, allowedAmounts: new Set([90000]), addendum: "x" },
  {
    showReservationForm: true,
    showDateTimePicker: true,
    pendingReservation: { tipo: "Suite Amarte" },
    formPrefill: { tipo: "Suite Amarte", precio: "90000" },
  }
);
assert.strictEqual(siteFlags.showReservationForm, true);
assert.deepStrictEqual(siteFlags.pendingReservation, { tipo: "Suite Amarte" });

const bareAmount = stripUntrustedCopAmounts(
  "Suite Amarte 4 h: $78000 y 200000 pesos",
  new Set()
);
assert.ok(!bareAmount.includes("78000"));
assert.ok(!bareAmount.includes("200000"));
assert.ok(bareAmount.includes("tarifa no disponible"));

const untouched = clampLandingReservation(null, {
  showReservationForm: true,
  showDateTimePicker: false,
  pendingReservation: { tipo: "Suite Amarte" },
  formPrefill: { tipo: "Suite Amarte" },
});
assert.strictEqual(untouched.showReservationForm, true);
assert.deepStrictEqual(untouched.pendingReservation, { tipo: "Suite Amarte" });

(async () => {
  assert.strictEqual(await beginLandingTurn("no-existe"), null);
  assert.strictEqual(await beginLandingTurn(""), null);

  setRoomRatesCacheForTests(tematicasRates);
  const turn = await beginLandingTurn("tematicas");
  assert.strictEqual(turn.pricesAvailable, true);
  assert.ok(turn.addendum.includes("tematicas"));
  assert.ok(turn.addendum.includes(formatCop(240000)));
  assert.match(turn.addendum, /showReservationForm|formulario/i);
  assert.ok(turn.addendum.includes("https://microservicio-suite-gamer.vercel.app") === false);

  const quoted = finishLandingReply(
    turn,
    `Árabe ${formatCop(240000)} y otra ${formatCop(78000)}.`,
    "precio"
  );
  assert.ok(quoted.includes(formatCop(240000)));
  assert.ok(!quoted.includes(formatCop(78000)));
  assert.ok(quoted.includes("tarifa no disponible"));

  const gamerGap = await beginLandingTurn("suite-gamer");
  assert.strictEqual(gamerGap.pricesAvailable, false);
  const inventedGamer = finishLandingReply(
    gamerGap,
    `Suite Gamer 4 h: ${formatCop(175000)}.`,
    "precio"
  );
  assert.ok(!inventedGamer.includes("175.000"));

  setRoomRatesCacheForTests(null);
  const siteDown = await beginPriceTurn(undefined);
  assert.strictEqual(siteDown.landing, null);
  assert.strictEqual(siteDown.pricesAvailable, false);
  assert.match(siteDown.addendum, /no inventes/i);
  assert.ok(!siteDown.addendum.includes("78.000"));
  const siteReply = finishLandingReply(
    siteDown,
    `VIP Jacuzzi 8 h: ${formatCop(200000)}.`,
    "precio"
  );
  assert.ok(!siteReply.includes("200.000"));
  assert.match(siteReply, /formulario|whatsapp/i);

  setRoomRatesCacheForTests(
    new Map([
      [
        "Suite Amarte",
        entry("Suite Amarte", { h4: 90000 }, { h4: 120000 }),
      ],
    ])
  );
  const siteUp = await beginPriceTurn("");
  assert.strictEqual(siteUp.pricesAvailable, true);
  assert.ok(siteUp.addendum.includes(formatCop(90000)));
  const siteQuote = finishLandingReply(
    siteUp,
    `Amarte ${formatCop(90000)} y otra ${formatCop(78000)}.`,
    "precio"
  );
  assert.ok(siteQuote.includes(formatCop(90000)));
  assert.ok(!siteQuote.includes(formatCop(78000)));

  setRoomRatesCacheForTests(null);
  const down = await beginLandingTurn("suite-gamer");
  assert.strictEqual(down.pricesAvailable, false);
  assert.match(down.addendum, /no inventes/i);
  resetRoomRatesCache();
  console.log("landingPolicy.test.js ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
