const assert = require("assert");
const {
  lookupCatalogPrice,
  normalizeDuration,
  toSpokenPrice,
  findCatalogEntry,
} = require("../services/catalogLookup");
const {
  setRoomRatesCacheForTests,
  resetRoomRatesCache,
} = require("../services/roomRatesCatalog");

assert.strictEqual(normalizeDuration("8 horas"), "h8");
assert.strictEqual(normalizeDuration("día hotelero"), "diaHotelero");

async function run() {
  // --- Fallback estático (sin BD) ---
  resetRoomRatesCache();
  setRoomRatesCacheForTests(null);

  const miss = await lookupCatalogPrice({
    suite: "Suite Inventada XYZ",
    date: "2026-07-09",
    duration: "8 horas",
  });
  assert.strictEqual(miss.found, false);

  const hitFallback = await lookupCatalogPrice({
    suite: "VIP Jacuzzi",
    date: "2026-07-09",
    duration: "8 horas",
  });
  assert.strictEqual(hitFallback.priceCop, null);
  assert.strictEqual(hitFallback.formattedPrice, null);
  assert.strictEqual(hitFallback.spokenPrice, null);
  assert.strictEqual(hitFallback.source, "unavailable");
  assert.match(hitFallback.message, /formulario|whatsapp/i);
  assert.ok(hitFallback.bookingUrl.includes("amartesuite.com"));

  const gamerMiss = await lookupCatalogPrice({
    suite: "Suite Gamer",
    date: "2026-10-21",
    duration: "6 horas",
  });
  assert.strictEqual(gamerMiss.priceCop, null);
  assert.strictEqual(gamerMiss.formattedPrice, null);
  assert.match(gamerMiss.message, /formulario|whatsapp/i);
  const gamerKnown = findCatalogEntry("Suite Gamer");
  assert.ok(gamerKnown);
  assert.strictEqual(gamerKnown.name, "Suite Gamer");
  assert.ok(gamerKnown.entry.weekday == null);

  const staticJacuzzi = findCatalogEntry("VIP Jacuzzi");
  assert.ok(staticJacuzzi);
  assert.strictEqual(staticJacuzzi.name, "Suite VIP Jacuzzi");
  assert.ok(staticJacuzzi.entry.weekday == null);

  setRoomRatesCacheForTests(
    new Map([
      [
        "Suite Jacuzzi",
        {
          name: "Suite Jacuzzi",
          kind: "suite",
          weekday: { h4: 0, h8: 240000 },
          weekend: { h4: 0, h8: 290000 },
        },
      ],
    ])
  );
  const jacuzziSimulado = await lookupCatalogPrice({
    suite: "VIP Jacuzzi",
    date: "2026-07-09",
    duration: "8 horas",
  });
  assert.strictEqual(jacuzziSimulado.priceCop, 240000);
  assert.strictEqual(jacuzziSimulado.source, "supabase");
  const jacuzziCero = await lookupCatalogPrice({
    suite: "VIP Jacuzzi",
    date: "2026-07-11",
    duration: "4 horas",
  });
  assert.strictEqual(jacuzziCero.priceCop, null);
  assert.strictEqual(jacuzziCero.source, "unavailable");
  assert.match(jacuzziCero.message, /formulario|whatsapp/i);

  setRoomRatesCacheForTests(
    new Map([
      [
        "Suite Jacuzzi",
        {
          name: "Suite Jacuzzi",
          kind: "suite",
          weekday: { h4: 0 },
          weekend: { h4: 0 },
        },
      ],
    ])
  );
  const zeroMenu = await lookupCatalogPrice({
    suite: "VIP Jacuzzi",
    date: "2026-07-09",
    duration: "",
  });
  assert.strictEqual(zeroMenu.priceCop, null);
  assert.strictEqual(zeroMenu.source, "unavailable");
  assert.ok(!zeroMenu.availableDurations.includes("4 horas"));
  assert.match(zeroMenu.message, /formulario|whatsapp/i);

  // --- SSOT mock Supabase ---
  const mock = new Map([
    [
      "Suite Diamante",
      {
        name: "Suite Diamante",
        kind: "suite",
        weekday: { h4: 240000, h8: 280000, h12: 340000, diaHotelero: 420000 },
        weekend: { h4: 300000, h8: 350000, h12: 420000, diaHotelero: 470000 },
      },
    ],
    [
      "Suite Jacuzzi",
      {
        name: "Suite Jacuzzi",
        kind: "suite",
        weekday: { h4: 200000, h8: 240000, h12: 300000, diaHotelero: 380000 },
        weekend: { h4: 240000, h8: 290000, h12: 360000, diaHotelero: 420000 },
      },
    ],
    [
      "Plan Amarte",
      {
        name: "Plan Amarte",
        kind: "plan",
        weekday: { h6: 210000, h12: 280000, diaHotelero: 320000 },
        weekend: { h6: 200000, h12: 340000, diaHotelero: 380000 },
      },
    ],
  ]);
  setRoomRatesCacheForTests(mock);

  const diamante = await lookupCatalogPrice({
    suite: "Diamante",
    date: "2026-07-09",
    duration: "4 horas",
  });
  assert.strictEqual(diamante.found, true);
  assert.strictEqual(diamante.suite, "Suite Diamante");
  assert.strictEqual(diamante.priceCop, 240000);
  assert.strictEqual(diamante.source, "supabase");
  assert.notStrictEqual(diamante.priceCop, 200000);

  const plan = await lookupCatalogPrice({
    suite: "Plan Amarte",
    date: "2026-07-09",
    duration: "6 horas",
  });
  assert.strictEqual(plan.found, true);
  assert.strictEqual(plan.priceCop, 210000);
  assert.strictEqual(plan.source, "supabase");

  const jacuzziDb = await lookupCatalogPrice({
    suite: "VIP Jacuzzi",
    date: "2026-07-09",
    duration: "8 horas",
  });
  assert.strictEqual(jacuzziDb.found, true);
  assert.strictEqual(jacuzziDb.priceCop, 240000);
  assert.strictEqual(jacuzziDb.source, "supabase");

  const spoken = toSpokenPrice(180000);
  assert.ok(spoken.includes("pesos"));
  assert.ok(!spoken.includes("$"));

  resetRoomRatesCache();
  console.log("catalogLookup tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
